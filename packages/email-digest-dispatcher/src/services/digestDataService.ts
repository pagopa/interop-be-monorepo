import { Logger } from "pagopa-interop-commons";
import { TenantId } from "pagopa-interop-models";

export type BaseDigest = {
  items: Array<{
    name: string;
    producerName: string;
    link: string;
  }>;
  totalCount: number;
};
export type DelegationDigest = BaseDigest & {
  items: Array<{
    delegationKind: "producer" | "consumer";
  }>;
};

export type AttributeDigest = BaseDigest & {
  items: Array<{
    attributeKind: "certified" | "verified";
  }>;
};

export type TenantDigestData = {
  tenantId: TenantId;
  tenantName: string;
  timePeriod: string;
  viewAllNewEservicesLink: string;
  viewAllUpdatedEservicesLink: string;
  viewAllSentAgreementsLink: string;
  viewAllSentPurposesLink: string;
  viewAllReceivedAgreementsLink: string;
  viewAllReceivedPurposesLink: string;
  viewAllSentDelegationsLink: string;
  viewAllReceivedDelegationsLink: string;
  viewAllAttributesLink: string;
  newEservices?: BaseDigest;
  updatedEservices?: BaseDigest;
  acceptedSentAgreements?: BaseDigest;
  rejectedSentAgreements?: BaseDigest;
  suspendedSentAgreements?: BaseDigest;
  publishedSentPurposes?: BaseDigest;
  rejectedSentPurposes?: BaseDigest;
  suspendedSentPurposes?: BaseDigest;
  waitingForApprovalReceivedAgreements?: BaseDigest;
  publishedReceivedPurposes?: BaseDigest;
  waitingForApprovalReceivedPurposes?: BaseDigest;
  activeSentDelegations?: DelegationDigest;
  rejectedSentDelegations?: DelegationDigest;
  waitingForApprovalReceivedDelegations?: DelegationDigest;
  revokedReceivedDelegations?: DelegationDigest;
  receivedAttributes?: AttributeDigest;
  revokedAttributes?: AttributeDigest;
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
        tenantName: "Tenant Name Placeholder",
        timePeriod: "Time Period Placeholder",
        viewAllNewEservicesLink: "#",
        viewAllUpdatedEservicesLink: "#",
        viewAllSentAgreementsLink: "#",
        viewAllSentPurposesLink: "#",
        viewAllReceivedAgreementsLink: "#",
        viewAllReceivedPurposesLink: "#",
        viewAllSentDelegationsLink: "#",
        viewAllReceivedDelegationsLink: "#",
        viewAllAttributesLink: "#",
        newEservices: {
          items: [],
          totalCount: 0,
        },
        updatedEservices: {
          items: [],
          totalCount: 0,
        },
        acceptedSentAgreements: {
          items: [],
          totalCount: 0,
        },
        rejectedSentAgreements: {
          items: [],
          totalCount: 0,
        },
        suspendedSentAgreements: {
          items: [],
          totalCount: 0,
        },
        publishedSentPurposes: {
          items: [],
          totalCount: 0,
        },
        rejectedSentPurposes: {
          items: [],
          totalCount: 0,
        },
        suspendedSentPurposes: {
          items: [],
          totalCount: 0,
        },
        waitingForApprovalReceivedAgreements: {
          items: [],
          totalCount: 0,
        },
        publishedReceivedPurposes: {
          items: [],
          totalCount: 0,
        },
        waitingForApprovalReceivedPurposes: {
          items: [],
          totalCount: 0,
        },
        activeSentDelegations: {
          items: [],
          totalCount: 0,
        },
        rejectedSentDelegations: {
          items: [],
          totalCount: 0,
        },
        waitingForApprovalReceivedDelegations: {
          items: [],
          totalCount: 0,
        },
        revokedReceivedDelegations: {
          items: [],
          totalCount: 0,
        },
        receivedAttributes: {
          items: [],
          totalCount: 0,
        },
        revokedAttributes: {
          items: [],
          totalCount: 0,
        },
      };
    },

    hasDigestContent(data: TenantDigestData): boolean {
      return !!(
        data.newEservices?.totalCount ||
        data.updatedEservices?.totalCount ||
        data.acceptedSentAgreements?.totalCount ||
        data.rejectedSentAgreements?.totalCount ||
        data.suspendedSentAgreements?.totalCount ||
        data.publishedSentPurposes?.totalCount ||
        data.rejectedSentPurposes?.totalCount ||
        data.suspendedSentPurposes?.totalCount ||
        data.waitingForApprovalReceivedAgreements?.totalCount ||
        data.publishedReceivedPurposes?.totalCount ||
        data.waitingForApprovalReceivedPurposes?.totalCount ||
        data.activeSentDelegations?.totalCount ||
        data.rejectedSentDelegations?.totalCount ||
        data.waitingForApprovalReceivedDelegations?.totalCount ||
        data.revokedReceivedDelegations?.totalCount ||
        data.receivedAttributes?.totalCount ||
        data.revokedAttributes?.totalCount
      );
    },
  };
}

export type DigestDataService = ReturnType<typeof digestDataServiceBuilder>;
