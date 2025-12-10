import { TenantId } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";

/**
 * Represents the digest data for a tenant.
 * This data is queried once per tenant and shared across all users of that tenant.
 */
export type TenantDigestData = {
  tenantId: TenantId;
  tenantName: string;
  // TODO: Add actual digest data fields when design is finalized
  summaryItems: DigestSummaryItem[];
};

export type DigestSummaryItem = {
  category: string;
  count: number;
  description: string;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function digestDataServiceBuilder(
  // Future dependencies will be added here
  // e.g., agreementReadModelService, catalogReadModelService, etc.
  logger: Logger
) {
  return {
    /**
     * Retrieves digest data for a tenant.
     * This is a MOCKUP implementation - will be replaced with actual readmodel queries.
     * Called once per tenant, result is shared across all users of that tenant.
     */
    async getDigestDataForTenant(
      tenantId: TenantId
    ): Promise<TenantDigestData> {
      logger.info(`Retrieving digest data for tenant ${tenantId}`);

      // TODO: Implement actual data retrieval from readmodel

      // MOCKUP: Return placeholder data
      return {
        tenantId,
        tenantName: "Tenant Name Placeholder", // TODO: Retrieve from tenant readmodel
        summaryItems: [
          {
            category: "Nuove richieste di fruizione",
            count: 0,
            description: "Nessuna nuova richiesta",
          },
          {
            category: "E-service aggiornati",
            count: 0,
            description: "Nessun aggiornamento",
          },
          {
            category: "Finalità in attesa",
            count: 0,
            description: "Nessuna finalità in attesa",
          },
        ],
      };
    },

    /**
     * Checks if there is any meaningful data to include in the digest.
     * If there's nothing to report, we might skip sending the email.
     */
    hasDigestContent(data: TenantDigestData): boolean {
      return data.summaryItems.some((item) => item.count > 0);
    },
  };
}

export type DigestDataService = ReturnType<typeof digestDataServiceBuilder>;
