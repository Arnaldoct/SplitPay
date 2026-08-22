/**
 * Dashboard auth helper
 *
 * Two resolvers live here during the Phase C migration:
 *
 *  - getUserVenue()   — LEGACY. Resolves supabase user -> venue_users -> venue.
 *                       Kept UNCHANGED until Stage C3 removes it; the not-yet-
 *                       migrated dashboard/guest routes still depend on it.
 *  - getAuthContext() — CANONICAL. Resolves supabase user -> users ->
 *                       memberships -> active org/location. Read-only.
 */

import { db } from "@/lib/db";
import { createServerClient } from "@/lib/supabase/server";
import { users, memberships, locations, organizations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// LEGACY resolver — do not change until Stage C3 retires it.
// ---------------------------------------------------------------------------
export async function getUserVenue() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, venueUser: null, venue: null };

  const venueUser = await db.query.venueUsers.findFirst({
    where: (vu, { eq }) => eq(vu.supabaseUserId, user.id),
    with: { venue: true },
  });

  return { user, venueUser: venueUser ?? null, venue: venueUser?.venue ?? null };
}

// ---------------------------------------------------------------------------
// CANONICAL resolver — supabase user -> users -> memberships -> org/location.
// ---------------------------------------------------------------------------

type DbUser = typeof users.$inferSelect;
type Organization = typeof organizations.$inferSelect;
type Location = typeof locations.$inferSelect;
type Membership = typeof memberships.$inferSelect;

export type MembershipWithRefs = Membership & {
  organization: Organization;
  location: Location | null;
};

export type AuthContext = {
  user: SupabaseUser | null;          // supabase auth user
  dbUser: DbUser | null;              // row from the users table
  isPlatformAdmin: boolean;
  memberships: MembershipWithRefs[];  // ACTIVE memberships only, ordered
  activeMembership: MembershipWithRefs | null;
  organization: Organization | null;
  location: Location | null;
  locationAmbiguous: boolean;         // org-wide role but org has >1 active location (v1 unsupported)
  onboardingComplete: boolean;        // derived from organization
};

const EMPTY_CONTEXT: AuthContext = {
  user: null,
  dbUser: null,
  isPlatformAdmin: false,
  memberships: [],
  activeMembership: null,
  organization: null,
  location: null,
  locationAmbiguous: false,
  onboardingComplete: false,
};

/**
 * Resolve the full tenant context for the logged-in user.
 *
 * READ-ONLY: this never writes. Linking supabase_user_id onto the users row is
 * done in /api/auth/link-user so the resolver stays pure and race-free.
 *
 * Degrades softly at every step (returns nulls, never throws) so a logged-in
 * user who is missing a users row or a membership can still render — the API
 * routes 404 rather than the whole page crashing or looping.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_CONTEXT;

  // Resolve the users row. supabase_user_id first; fall back to lowercased
  // email so a backfilled user with a NULL supabase_user_id (never logged in)
  // still resolves BEFORE link-user runs. Case never blocks the match.
  const email = user.email?.toLowerCase() ?? null;
  let dbUser = await db.query.users.findFirst({
    where: eq(users.supabaseUserId, user.id),
  });
  if (!dbUser && email) {
    dbUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  // Valid session but nobody in users: soft-null context (admin promotion or
  // provisioning issue). Caller decides; no throw, no redirect loop.
  if (!dbUser) return { ...EMPTY_CONTEXT, user };

  // Active memberships with their org + location.
  const rows = (await db.query.memberships.findMany({
    where: and(eq(memberships.userId, dbUser.id), eq(memberships.active, true)),
    with: { organization: true, location: true },
  })) as MembershipWithRefs[];

  // Decision #1: deterministic active membership even with >1 —
  // org_admin first, then most recently created. No switcher in v1.
  const ordered = [...rows].sort((a, b) => {
    const ap = a.role === "org_admin" ? 0 : 1;
    const bp = b.role === "org_admin" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const activeMembership = ordered[0] ?? null;
  const organization = activeMembership?.organization ?? null;

  // Decision #2: resolve the location.
  let location: Location | null = null;
  let locationAmbiguous = false;
  if (activeMembership && organization) {
    if (activeMembership.location) {
      // location-scoped membership (location_manager, server)
      location = activeMembership.location;
    } else {
      // org-wide role (org_admin, accountant): resolve to the org's sole
      // location. Ambiguous if the org has more than one (v1 has no switcher).
      const orgLocations = await db.query.locations.findMany({
        where: and(
          eq(locations.organizationId, organization.id),
          eq(locations.active, true)
        ),
      });
      if (orgLocations.length === 1) {
        location = orgLocations[0];
      } else if (orgLocations.length > 1) {
        locationAmbiguous = true;
      }
    }
  }

  return {
    user,
    dbUser,
    isPlatformAdmin: dbUser.isPlatformAdmin,
    memberships: ordered,
    activeMembership,
    organization,
    location,
    locationAmbiguous,
    onboardingComplete: organization?.onboardingComplete ?? false,
  };
}

/**
 * Shared platform-admin gate used by lib/admin.ts (server components) and the
 * admin API routes. Returns the resolved context plus an `ok` boolean so a
 * caller can distinguish unauthenticated (ctx.user === null) from
 * authenticated-but-not-admin (ok === false).
 */
export async function requirePlatformAdmin(): Promise<{ ok: boolean; ctx: AuthContext }> {
  const ctx = await getAuthContext();
  return { ok: ctx.isPlatformAdmin, ctx };
}
