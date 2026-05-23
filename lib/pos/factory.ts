/**
 * POS Adapter Factory
 * 
 * Creates the appropriate POS adapter based on the integration type
 * stored in the database for a venue.
 */

import { POSAdapter, POSAdapterConfig } from "./adapter";
import { ManualAdapter } from "./manual-adapter";
import { SquareAdapter } from "./square-adapter";
import { ToastAdapter } from "./toast-adapter";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";

export async function createPOSAdapter(venueId: string): Promise<POSAdapter> {
  // Fetch the active integration for this venue
  const integration = await db.query.integrations.findFirst({
    where: (i, { eq: eqOp, and }) =>
      and(eqOp(i.venueId, venueId), eqOp(i.active, true)),
  });

  // Default to manual adapter if no integration
  if (!integration) {
    return new ManualAdapter({ venueId, credentials: {} });
  }

  const config: POSAdapterConfig = {
    venueId,
    credentials: (integration.credentials as Record<string, string>) || {},
  };

  // Create the appropriate adapter based on provider
  switch (integration.provider) {
    case "square":
      return new SquareAdapter(config);

    case "toast":
      return new ToastAdapter(config);

    case "clover":
      // TODO: Implement CloverAdapter in Stage 12
      throw new Error("Clover integration not yet implemented");

    case "manual":
    default:
      return new ManualAdapter(config);
  }
}

/**
 * Get adapter by explicit provider name (useful for testing)
 */
export function createPOSAdapterByProvider(
  provider: string,
  config: POSAdapterConfig
): POSAdapter {
  switch (provider) {
    case "square":
      return new SquareAdapter(config);

    case "toast":
      return new ToastAdapter(config);

    case "manual":
      return new ManualAdapter(config);

    default:
      throw new Error(`Unknown POS provider: ${provider}`);
  }
}
