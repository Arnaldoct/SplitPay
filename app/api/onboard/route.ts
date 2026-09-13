/**
 * API Route: Complete Venue Onboarding
 *
 * C3.4: resolves tenancy via requireTenantContext (canonical org/location) and
 * splits the wizard payload per Decision #3 — org fields (legal/tax/country) go
 * to `organizations`, location fields (address/contact/branding) go to
 * `locations`, `name` is synced across both, and paymentModel is derived onto
 * the location from the country. `onboardingComplete` is set on the ORGANIZATION
 * only (the sole place the column exists; it is what getAuthContext reads for the
 * onboarding redirect gate). Both writes run in one transaction so they flip
 * together.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, locations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultPaymentModel } from "@/lib/payments/factory";
import { requireTenantContext } from "@/lib/dashboard-auth";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "name",
      "legalName",
      "businessType",
      "taxId",
      "country",
      "address",
      "city",
      "state",
      "zip",
      "phone",
      "timezone",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const country = body.country.toUpperCase();

    // Split the payload across org + location in one transaction so both flip
    // together (name synced, onboarding_complete set on the org).
    await db.transaction(async (tx) => {
      // Org owns legal/tax/country/name + the onboarding gate flag.
      await tx
        .update(organizations)
        .set({
          name: body.name,
          legalName: body.legalName,
          businessType: body.businessType,
          taxId: body.taxId,
          country,
          onboardingComplete: true,
          updatedAt: now,
        })
        .where(eq(organizations.id, ctx.organization.id));

      // Location owns address/contact/branding + derived paymentModel + name.
      await tx
        .update(locations)
        .set({
          name: body.name,
          address: body.address,
          city: body.city,
          state: body.state,
          zip: body.zip,
          phone: body.phone,
          timezone: body.timezone,
          website: body.website || null,
          logoUrl: body.logoUrl || null,
          brandColor: body.brandColor || null,
          paymentModel: getDefaultPaymentModel(country),
          updatedAt: now,
        })
        .where(eq(locations.id, ctx.location.id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to save onboarding data" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const ctx = await requireTenantContext();
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { organization: org, location } = ctx;

    // Return the current org + location data for pre-filling the wizard.
    return NextResponse.json({
      venue: {
        name: org.name,
        legalName: org.legalName,
        businessType: org.businessType,
        taxId: org.taxId,
        country: org.country,
        address: location.address,
        city: location.city,
        state: location.state,
        zip: location.zip,
        phone: location.phone,
        timezone: location.timezone,
        website: location.website,
        logoUrl: location.logoUrl,
        brandColor: location.brandColor,
        onboardingComplete: org.onboardingComplete,
      },
    });
  } catch (error) {
    console.error("Get onboarding data error:", error);
    return NextResponse.json(
      { error: "Failed to get onboarding data" },
      { status: 500 }
    );
  }
}
