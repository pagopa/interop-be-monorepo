import { TenantId } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";

/**
 * Represents the digest data for a tenant.
 * This data is queried once per tenant and shared across all users of that tenant.
 */
export type TenantDigestData = {
  tenantId: TenantId;
  tenantName: string;
  timePeriod: string;
  eservices?: EservicesData;
  eserviceTemplate?: EserviceTemplateData;
  agreements?: AgreementsData;
  purposes?: PurposesData;
  delegations?: DelegationsData;
  attributes?: AttributesData;
  catalogLink?: string;
  templateCatalogLink?: string;
  agreementsSentLink?: string;
  agreementsReceivedLink?: string;
  purposesSentLink?: string;
  purposesReceivedLink?: string;
  delegationsSentLink?: string;
  delegationsReceivedLink?: string;
  attributesLink?: string;
};

export type EserviceItem = {
  name: string;
  link: string;
};

export type EserviceUpdatedItem = EserviceItem & {
  version: string;
};

export type EservicesData = {
  updated?: {
    items: EserviceUpdatedItem[];
    additionalCount?: number;
  };
  new?: {
    items: EserviceItem[];
  };
  templatesUpdated?: {
    items: EserviceItem[];
  };
};

export type TemplateWithInstancesItem = {
  name: string;
  link: string;
  instanceCount: number;
};

export type EserviceTemplateData = {
  templateWithInstances?: {
    items: TemplateWithInstancesItem[];
  };
};

export type AgreementItem = {
  name: string;
  link: string;
};

export type AgreementsByState = {
  state: string;
  stateLink: string;
  count: number;
  items: AgreementItem[];
};

export type AgreementsData = {
  consumerAgreements?: {
    byState: AgreementsByState[];
  };
  producerAgreements?: {
    byState: AgreementsByState[];
  };
};

export type PurposeItem = {
  name: string;
  link: string;
};

export type PurposesByState = {
  state: string;
  count: number;
  items: PurposeItem[];
};

export type PurposesData = {
  consumerPurposes?: {
    byState: PurposesByState[];
  };
  producerPurposes?: {
    byState: PurposesByState[];
  };
};

export type DelegationItem = {
  name: string;
  link: string;
  delegationType: string;
};

export type DelegationsByState = {
  state: string;
  count: number;
  items: DelegationItem[];
};

export type DelegationsData = {
  delegatorDelegations?: {
    byState: DelegationsByState[];
  };
  delegateDelegations?: {
    byState: DelegationsByState[];
  };
};

export type AttributeItem = {
  type: string;
  name: string;
  action: string;
};

export type AttributesData = {
  items?: AttributeItem[];
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
        timePeriod: "ultima settimana",
        // TODO: Populate these fields with actual data from readmodel
        // eservices: undefined,
        // eserviceTemplate: undefined,
        // agreements: undefined,
        // purposes: undefined,
        // delegations: undefined,
        // attributes: undefined,
      };
    },

    /**
     * Checks if there is any meaningful data to include in the digest.
     * If there's nothing to report, we might skip sending the email.
     */
    hasDigestContent(data: TenantDigestData): boolean {
      return !!(
        data.eservices?.updated?.items.length ||
        data.eservices?.new?.items.length ||
        data.eservices?.templatesUpdated?.items.length ||
        data.eserviceTemplate?.templateWithInstances?.items.length ||
        data.agreements?.consumerAgreements?.byState.length ||
        data.agreements?.producerAgreements?.byState.length ||
        data.purposes?.consumerPurposes?.byState.length ||
        data.purposes?.producerPurposes?.byState.length ||
        data.delegations?.delegatorDelegations?.byState.length ||
        data.delegations?.delegateDelegations?.byState.length ||
        data.attributes?.items?.length
      );
    },
  };
}

export type DigestDataService = ReturnType<typeof digestDataServiceBuilder>;
