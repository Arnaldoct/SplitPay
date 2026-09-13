/**
 * API Route: Get/Create/Update Venue
 *
 * C3.4: GET/PUT resolve tenancy via requireTenantContext (canonical org/location)
 * and split fields per Decision #3 — the ORGANIZATION owns legal/tax/country/
 * billing; the LOCATION owns contact/address/branding/payment. `name` is kept in
 * sync across both. POST creates the canonical org/location/user/membership
 * graph PLUS the legacy venue/venue_user rows (Option A dual-write), so the
 * NOT-NULL venue_id FKs on tables/checks/integrations stay satisfiable during
 * the expand phase.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  venues,
  venueUsers,
  organizations,
  locations,
  users,
  memberships,
  integrations,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createServerClient } from "@/lib/supabase/server";
import { getDefaultPaymentModel } from "@/lib/payments/factory";
import { requireTenantContext } from "@/lib/dashboard-auth";

type Organization = typeof organizations.$inferSelect;
type Location = typeof locations.$inferSelect;

// Merge org + location into the single flat object the settings page reads,
// mutates, and PUTs back WHOLE. It MUST expose every key the page reads, or the
// whole-object round-trip silently drops that field on the next save. This
// reproduces the exact flat shape the legacy full-venue-row GET returned.
function toVenueResponse(org: Organization, location: Location) {
  return {
    id: location.id,
    name: location.name, // synced across org + location
    // location-owned
    slug: location.slug,
    email: location.email,
    phone: location.phone,
    address: location.address,
    city: location.city,
    state: location.state,
    zip: location.zip,
    timezone: location.timezone,
    website: location.website,
    logoUrl: location.logoUrl,
    brandColor: location.brandColor,
    tipSuggestions: location.tipSuggestions,
    paymentModel: location.paymentModel,
    stripeAccountId: location.stripeAccountId,
    stripeOnboardingComplete: location.stripeOnboardingComplete,
    active: location.active,
    // org-owned
    legalName: org.legalName,
    businessType: org.businessType,
    taxId: org.taxId,
    country: org.country,
    billingEmail: org.billingEmail,
    onboardingComplete: org.onboardingComplete,
  };
}

// GET - Fetch the current user's venue (merged org + location)
export async function GET() {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    return NextResponse.json(toVenueResponse(ctx.organization, ctx.location));
  } catch (error) {
    console.error("Error fetching venue:", error);
    return NextResponse.json({ error: "Failed to fetch venue" }, { status: 500 });
  }
}

// POST - Create a new tenant for the logged-in user.
//
// Option A (expand-phase dual-write): builds the canonical graph
// (organization -> location -> users row/link -> membership -> integration) AND
// the legacy venue + venue_user rows, all in one transaction. locations.id is
// pinned to venues.id so the NOT-NULL venue_id FKs on tables/checks/integrations
// (which stamp venueId = location.id) keep resolving until the contract migration.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.email) {
      return NextResponse.json({ error: "Authenticated user has no email" }, { status: 400 });
    }

    const body = await request.json();
    const { name, country = "US" } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const normalizedCountry = country.toUpperCase();
    const paymentModel = getDefaultPaymentModel(country);
    const email = user.email;
    const emailLower = email.toLowerCase();

    // One unique slug reused across org/location/venue (distinct tables).
    const base = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${base}-${Date.now()}`;

    const { org, location } = await db.transaction(async (tx) => {
      // 1. Organization — billing / compliance owner
      const [organization] = await tx
        .insert(organizations)
        .values({ name: trimmedName, slug, country: normalizedCountry })
        .returning();

      // 2. Legacy venue — its id becomes the shared location id (locations.id == venues.id)
      const [venue] = await tx
        .insert(venues)
        .values({ name: trimmedName, slug, email, country: normalizedCountry, paymentModel })
        .returning();

      // 3. Canonical location, pinned to the venue id
      const [loc] = await tx
        .insert(locations)
        .values({
          id: venue.id,
          organizationId: organization.id,
          name: trimmedName,
          slug,
          email,
          paymentModel,
        })
        .returning();

      // 4. Users row (canonical). Reuse an existing row by lowercased email,
      //    linking supabase_user_id if unset; otherwise insert a new one.
      let dbUser = await tx.query.users.findFirst({ where: eq(users.email, emailLower) });
      if (!dbUser) {
        [dbUser] = await tx
          .insert(users)
          .values({ email: emailLower, supabaseUserId: user.id })
          .returning();
      } else if (!dbUser.supabaseUserId) {
        await tx.update(users).set({ supabaseUserId: user.id }).where(eq(users.id, dbUser.id));
      }

      // 5. Membership — owner maps to org_admin (org-wide, location_id NULL)
      await tx.insert(memberships).values({
        userId: dbUser.id,
        organizationId: organization.id,
        locationId: null,
        role: "org_admin",
      });

      // 6. Legacy venue_user dual-write (owner)
      await tx.insert(venueUsers).values({
        venueId: venue.id,
        email,
        supabaseUserId: user.id,
        role: "owner",
      });

      // 7. Default manual integration (needs venue_id + both tenant columns)
      await tx.insert(integrations).values({
        venueId: venue.id,
        locationId: loc.id,
        organizationId: organization.id,
        provider: "manual",
      });

      return { org: organization, location: loc };
    });

    return NextResponse.json(toVenueResponse(org, location), { status: 201 });
  } catch (error) {
    console.error("Error creating venue:", error);
    return NextResponse.json({ error: "Failed to create venue" }, { status: 500 });
  }
}

// PUT - Update the venue: route each field to org or location, keep name in sync
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zip, timezone, tipSuggestions, country } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const now = new Date();

    // Both writes in one transaction so the org/location name sync is atomic.
    const [org, location] = await db.transaction(async (tx) => {
      // Org owns country; `name` syncs here. paymentModel is derived onto the
      // LOCATION, so country only touches the org row itself.
      const [updatedOrg] = await tx
        .update(organizations)
        .set({
          name,
          ...(country ? { country: country.toUpperCase() } : {}),
          updatedAt: now,
        })
        .where(eq(organizations.id, ctx.organization.id))
        .returning();

      // Location owns contact/address/settings; `name` syncs here too. When
      // country changes, re-derive the location's paymentModel from it.
      const [updatedLocation] = await tx
        .update(locations)
        .set({
          name,
          email,
          phone,
          address,
          city,
          state,
          zip,
          timezone,
          tipSuggestions,
          ...(country ? { paymentModel: getDefaultPaymentModel(country) } : {}),
          updatedAt: now,
        })
        .where(eq(locations.id, ctx.location.id))
        .returning();

      return [updatedOrg, updatedLocation] as const;
    });

    return NextResponse.json(toVenueResponse(org, location));
  } catch (error) {
    console.error("Error updating venue:", error);
    return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
  }
}
