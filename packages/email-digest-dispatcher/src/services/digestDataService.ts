import { Logger } from "pagopa-interop-commons";
import { TenantId } from "pagopa-interop-models";
import {
  eserviceTemplateToBaseDigest,
  eserviceToBaseDigest,
} from "../model/digestDataConverter.js";
import { NewEservice, ReadModelService } from "./readModelService.js";
import { SimpleCache } from "./simpleCache.js";

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
  updatedEserviceTemplates?: BaseDigest;
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
  readModelService: ReadModelService,
  logger: Logger
) {
  const newEservicesCache = new SimpleCache<NewEservice>(
    logger,
    "New e-services"
  );

  /**
   * Constructs a digest for new e-services (same for all users)
   * Uses in-memory cache with 3-hour TTL to avoid repeated database queries.
   */
  async function getNewEservicesDigest(
    priorityProducerIds: TenantId[]
  ): Promise<BaseDigest> {
    logger.info("Building new e-services digest");

    const cachedData = newEservicesCache.get();
    if (cachedData !== null) {
      logger.info("Cache hit - using cached new e-services data");
      return eserviceToBaseDigest(cachedData, readModelService);
    }

    // Cache miss - fetch from database
    logger.info("Cache miss - fetching new e-services from database");
    const fetchedData = await readModelService.getNewEservices(
      priorityProducerIds
    );

    // Store in cache
    newEservicesCache.set(fetchedData);
    return eserviceToBaseDigest(fetchedData, readModelService);
  }

  return {
    async getDigestDataForTenant(
      tenantId: TenantId
    ): Promise<TenantDigestData> {
      logger.info(`Retrieving digest data for tenant ${tenantId}`);

      // Fetch all data in parallel for performance
      const [
        updatedEservices,
        updatedEserviceTemplates,
        tenantMap,
        newEservices,
      ] = await Promise.all([
        readModelService.getNewVersionEservices(tenantId),
        readModelService.getNewEserviceTemplates(tenantId),
        readModelService.getTenantsByIds([tenantId]),
        // TODO: ask for priority list of tenants
        getNewEservicesDigest([]),
      ]);

      const tenantName = tenantMap.get(tenantId);

      return {
        tenantId,
        tenantName: tenantName ?? "Tenant Name Placeholder",
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
        newEservices,
        updatedEservices: await eserviceToBaseDigest(
          updatedEservices,
          readModelService
        ),
        updatedEserviceTemplates: await eserviceTemplateToBaseDigest(
          updatedEserviceTemplates,
          readModelService
        ),
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
