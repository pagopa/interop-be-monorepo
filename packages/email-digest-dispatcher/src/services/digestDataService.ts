import { Logger } from "pagopa-interop-commons";
import {
  agreementState,
  TenantId,
  purposeVersionState,
  delegationState,
} from "pagopa-interop-models";
import {
  receivedAgreementsToBaseDigest,
  sentAgreementsToBaseDigest,
  eserviceTemplateToBaseDigest,
  eserviceToBaseDigest,
  popularEserviceTemplateToBaseDigest,
  verifiedAttributeToDigest,
  certifiedAttributeToDigest,
  combineAttributeDigests,
  sentPurposesToBaseDigest,
  receivedPurposesToBaseDigest,
  sentDelegationsToDigest,
  receivedDelegationsToDigest,
} from "../model/digestDataConverter.js";
import {
  viewAllNewEservicesLink,
  viewAllUpdatedEservicesLink,
  viewAllSentAgreementsLink,
  viewAllSentPurposesLink,
  viewAllReceivedAgreementsLink,
  viewAllReceivedPurposesLink,
  viewAllSentDelegationsLink,
  viewAllReceivedDelegationsLink,
  viewAllAttributesLink,
  viewAllUpdatedEserviceTemplatesLink,
  viewAllPopularEserviceTemplatesLink,
} from "./deeplinkBuilder.js";
import { NewEservice, ReadModelService } from "./readModelService.js";
import { SimpleCache } from "./simpleCache.js";

export type BaseDigest = {
  items: Array<{
    id?: string;
    name: string;
    producerName: string;
    link: string;
  }>;
  totalCount: number;
};

export type DelegationDigest = BaseDigest & {
  items: Array<{
    delegationKind: "erogazione" | "fruizione";
  }>;
};

export type ReceivedPurposeDigest = BaseDigest & {
  items: Array<{
    consumerName: string;
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
  viewAllUpdatedEserviceTemplatesLink: string;
  viewAllPopularEserviceTemplatesLink: string;
  newEservices?: BaseDigest;
  updatedEservices?: BaseDigest;
  updatedEserviceTemplates?: BaseDigest;
  popularEserviceTemplates?: BaseDigest;
  acceptedSentAgreements?: BaseDigest;
  rejectedSentAgreements?: BaseDigest;
  suspendedSentAgreements?: BaseDigest;
  publishedSentPurposes?: BaseDigest;
  rejectedSentPurposes?: BaseDigest;
  waitingForApprovalSentPurposes?: BaseDigest;
  waitingForApprovalReceivedAgreements?: BaseDigest;
  publishedReceivedPurposes?: ReceivedPurposeDigest;
  waitingForApprovalReceivedPurposes?: ReceivedPurposeDigest;
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
        popularEserviceTemplates,
        tenantMap,
        newEservices,
        sentAgreements,
        receivedAgreements,
        sentPurposes,
        receivedPurposes,
        sentDelegations,
        receivedDelegations,
        verifiedAssignedAttributes,
        verifiedRevokedAttributes,
        certifiedAssignedAttributes,
        certifiedRevokedAttributes,
      ] = await Promise.all([
        readModelService.getNewVersionEservices(tenantId),
        readModelService.getNewEserviceTemplates(tenantId),
        readModelService.getPopularEserviceTemplates(tenantId),
        readModelService.getTenantsByIds([tenantId]),
        // TODO: ask for priority list of tenants
        getNewEservicesDigest([]),
        readModelService.getSentAgreements(tenantId), // tenantId as consumerId
        readModelService.getReceivedAgreements(tenantId), // tenantId as producerId
        readModelService.getSentPurposes(tenantId), // tenantId as consumerId
        readModelService.getReceivedPurposes(tenantId), // tenantId as producerId
        readModelService.getSentDelegations(tenantId), // tenantId as delegatorId
        readModelService.getReceivedDelegations(tenantId), // tenantId as delegateId
        readModelService.getVerifiedAssignedAttributes(tenantId),
        readModelService.getVerifiedRevokedAttributes(tenantId),
        readModelService.getCertifiedAssignedAttributes(tenantId),
        readModelService.getCertifiedRevokedAttributes(tenantId),
      ]);

      const tenantName = tenantMap.get(tenantId);

      return {
        tenantId,
        tenantName: tenantName ?? "Tenant Name Placeholder",
        timePeriod: "Time Period Placeholder",
        viewAllNewEservicesLink,
        viewAllUpdatedEservicesLink,
        viewAllSentAgreementsLink,
        viewAllSentPurposesLink,
        viewAllReceivedAgreementsLink,
        viewAllReceivedPurposesLink,
        viewAllSentDelegationsLink,
        viewAllReceivedDelegationsLink,
        viewAllAttributesLink,
        viewAllUpdatedEserviceTemplatesLink,
        viewAllPopularEserviceTemplatesLink,
        newEservices,
        updatedEservices: await eserviceToBaseDigest(
          updatedEservices,
          readModelService
        ),
        updatedEserviceTemplates: await eserviceTemplateToBaseDigest(
          updatedEserviceTemplates,
          readModelService
        ),
        popularEserviceTemplates: await popularEserviceTemplateToBaseDigest(
          popularEserviceTemplates,
          readModelService
        ),
        acceptedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.active,
          readModelService
        ),
        rejectedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.rejected,
          readModelService
        ),
        suspendedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.suspended,
          readModelService
        ),
        publishedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.active
        ),
        rejectedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.rejected
        ),
        waitingForApprovalSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.waitingForApproval
        ),
        waitingForApprovalReceivedAgreements:
          await receivedAgreementsToBaseDigest(
            receivedAgreements,
            readModelService
          ),
        publishedReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.active
        ),
        waitingForApprovalReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.waitingForApproval
        ),
        activeSentDelegations: await sentDelegationsToDigest(
          sentDelegations,
          delegationState.active,
          readModelService
        ),
        rejectedSentDelegations: await sentDelegationsToDigest(
          sentDelegations,
          delegationState.rejected,
          readModelService
        ),
        waitingForApprovalReceivedDelegations:
          await receivedDelegationsToDigest(
            receivedDelegations,
            delegationState.waitingForApproval,
            readModelService
          ),
        revokedReceivedDelegations: await receivedDelegationsToDigest(
          receivedDelegations,
          delegationState.revoked,
          readModelService
        ),
        receivedAttributes: combineAttributeDigests(
          await verifiedAttributeToDigest(
            verifiedAssignedAttributes,
            readModelService
          ),
          certifiedAttributeToDigest(certifiedAssignedAttributes)
        ),
        revokedAttributes: combineAttributeDigests(
          await verifiedAttributeToDigest(
            verifiedRevokedAttributes,
            readModelService
          ),
          certifiedAttributeToDigest(certifiedRevokedAttributes)
        ),
      };
    },

    hasDigestContent(data: TenantDigestData): boolean {
      return !!(
        data.newEservices?.totalCount ||
        data.updatedEservices?.totalCount ||
        data.updatedEserviceTemplates?.totalCount ||
        data.popularEserviceTemplates?.totalCount ||
        data.acceptedSentAgreements?.totalCount ||
        data.rejectedSentAgreements?.totalCount ||
        data.suspendedSentAgreements?.totalCount ||
        data.publishedSentPurposes?.totalCount ||
        data.rejectedSentPurposes?.totalCount ||
        data.waitingForApprovalSentPurposes?.totalCount ||
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
