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
  verifiedAttributeToDigest,
  certifiedAttributeToDigest,
  combineAttributeDigests,
  sentPurposesToBaseDigest,
  receivedPurposesToBaseDigest,
  receivedDelegationsToDigest,
} from "../model/digestDataConverter.js";
import {
  viewAllNewUpdatedEservicesLink,
  viewAllSentAgreementsLink,
  viewAllSentPurposesLink,
  viewAllReceivedAgreementsLink,
  viewAllReceivedPurposesLink,
  viewAllReceivedDelegationsLink,
  viewAllAttributesLink,
  viewAllUpdatedEserviceTemplatesLink,
  notificationSettingsLink,
} from "./deeplinkBuilder.js";
import { NewEservice, ReadModelService } from "./readModelService.js";
import { SimpleCache } from "./simpleCache.js";

const CARD_ITEMS = 6;
const LIST_ITEMS = 5;

export type BaseDigest = {
  items: Array<{
    id?: string;
    name: string;
    producerName: string;
    link: string;
  }>;
  totalCount: number;
  remainingCount: number;
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
    attributeKindLabel: string;
  }>;
};

export type TenantDigestData = {
  tenantId: TenantId;
  tenantName: string;
  notificationSettingsLink: string;
  viewAllNewEservicesLink: string;
  viewAllUpdatedEservicesLink: string;
  viewAllSentAgreementsLink: string;
  viewAllSentPurposesLink: string;
  viewAllReceivedAgreementsLink: string;
  viewAllReceivedPurposesLink: string;
  viewAllReceivedDelegationsLink: string;
  viewAllAttributesLink: string;
  viewAllUpdatedEserviceTemplatesLink: string;
  newEservices?: BaseDigest;
  updatedEservices?: BaseDigest;
  updatedEserviceTemplates?: BaseDigest;
  acceptedSentAgreements?: BaseDigest;
  rejectedSentAgreements?: BaseDigest;
  suspendedSentAgreements?: BaseDigest;
  publishedSentPurposes?: BaseDigest;
  rejectedSentPurposes?: BaseDigest;
  waitingForApprovalSentPurposes?: BaseDigest;
  waitingForApprovalReceivedAgreements?: BaseDigest;
  publishedReceivedPurposes?: ReceivedPurposeDigest;
  waitingForApprovalReceivedPurposes?: ReceivedPurposeDigest;
  waitingForApprovalReceivedDelegations?: DelegationDigest;
  revokedReceivedDelegations?: DelegationDigest;
  receivedAttributes?: AttributeDigest;
  revokedAttributes?: AttributeDigest;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function digestDataServiceBuilder(
  readModelService: ReadModelService,
  logger: Logger,
  priorityProducerIds: TenantId[]
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
    priorityProducerIds: TenantId[],
    selfcareId: string | null,
    maxItems: number
  ): Promise<BaseDigest> {
    logger.info("Building new e-services digest");

    const cachedData = newEservicesCache.get();
    if (cachedData !== null) {
      logger.info("Cache hit - using cached new e-services data");
      return eserviceToBaseDigest(
        cachedData,
        readModelService,
        selfcareId,
        maxItems
      );
    }

    // Cache miss - fetch from database
    logger.info("Cache miss - fetching new e-services from database");
    const fetchedData =
      await readModelService.getNewEservices(priorityProducerIds);

    // Store in cache
    newEservicesCache.set(fetchedData);
    return eserviceToBaseDigest(
      fetchedData,
      readModelService,
      selfcareId,
      maxItems
    );
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
        tenantDataMap,
        sentAgreements,
        receivedAgreements,
        sentPurposes,
        receivedPurposes,
        receivedDelegations,
        verifiedAssignedAttributes,
        verifiedRevokedAttributes,
        certifiedAssignedAttributes,
        certifiedRevokedAttributes,
      ] = await Promise.all([
        readModelService.getNewVersionEservices(tenantId),
        readModelService.getNewEserviceTemplates(tenantId),
        readModelService.getTenantsByIds([tenantId]),
        readModelService.getSentAgreements(tenantId), // tenantId as consumerId
        readModelService.getReceivedAgreements(tenantId), // tenantId as producerId
        readModelService.getSentPurposes(tenantId), // tenantId as consumerId
        readModelService.getReceivedPurposes(tenantId), // tenantId as producerId
        readModelService.getReceivedDelegations(tenantId), // tenantId as delegateId
        readModelService.getVerifiedAssignedAttributes(tenantId),
        readModelService.getVerifiedRevokedAttributes(tenantId),
        readModelService.getCertifiedAssignedAttributes(tenantId),
        readModelService.getCertifiedRevokedAttributes(tenantId),
      ]);

      const tenantData = tenantDataMap.get(tenantId);
      const tenantName = tenantData?.name ?? "Tenant Name Placeholder";
      const selfcareId = tenantData?.selfcareId ?? null;

      // Fetch new e-services with selfcareId (needs to be after we have selfcareId)
      const newEservices = await getNewEservicesDigest(
        priorityProducerIds,
        selfcareId,
        CARD_ITEMS
      );

      return {
        tenantId,
        tenantName,
        notificationSettingsLink: notificationSettingsLink(selfcareId),
        viewAllNewEservicesLink: viewAllNewUpdatedEservicesLink(selfcareId),
        viewAllUpdatedEservicesLink: viewAllNewUpdatedEservicesLink(selfcareId),
        viewAllSentAgreementsLink: viewAllSentAgreementsLink(selfcareId),
        viewAllSentPurposesLink: viewAllSentPurposesLink(selfcareId),
        viewAllReceivedAgreementsLink:
          viewAllReceivedAgreementsLink(selfcareId),
        viewAllReceivedPurposesLink: viewAllReceivedPurposesLink(selfcareId),
        viewAllReceivedDelegationsLink:
          viewAllReceivedDelegationsLink(selfcareId),
        viewAllAttributesLink: viewAllAttributesLink(selfcareId),
        viewAllUpdatedEserviceTemplatesLink:
          viewAllUpdatedEserviceTemplatesLink(selfcareId),
        newEservices,
        updatedEservices: await eserviceToBaseDigest(
          updatedEservices,
          readModelService,
          selfcareId,
          CARD_ITEMS
        ),
        updatedEserviceTemplates: await eserviceTemplateToBaseDigest(
          updatedEserviceTemplates,
          readModelService,
          selfcareId,
          CARD_ITEMS
        ),
        acceptedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.active,
          readModelService,
          selfcareId,
          LIST_ITEMS
        ),
        rejectedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.rejected,
          readModelService,
          selfcareId,
          LIST_ITEMS
        ),
        suspendedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.suspended,
          readModelService,
          selfcareId,
          LIST_ITEMS
        ),
        publishedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.active,
          selfcareId,
          LIST_ITEMS
        ),
        rejectedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.rejected,
          selfcareId,
          LIST_ITEMS
        ),
        waitingForApprovalSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.waitingForApproval,
          selfcareId,
          LIST_ITEMS
        ),
        waitingForApprovalReceivedAgreements:
          await receivedAgreementsToBaseDigest(
            receivedAgreements,
            readModelService,
            selfcareId,
            LIST_ITEMS
          ),
        publishedReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.active,
          selfcareId,
          LIST_ITEMS
        ),
        waitingForApprovalReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.waitingForApproval,
          selfcareId,
          LIST_ITEMS
        ),
        waitingForApprovalReceivedDelegations:
          await receivedDelegationsToDigest(
            receivedDelegations,
            delegationState.waitingForApproval,
            readModelService,
            selfcareId,
            LIST_ITEMS
          ),
        revokedReceivedDelegations: await receivedDelegationsToDigest(
          receivedDelegations,
          delegationState.revoked,
          readModelService,
          selfcareId,
          LIST_ITEMS
        ),
        receivedAttributes: combineAttributeDigests(
          await verifiedAttributeToDigest(
            verifiedAssignedAttributes,
            readModelService
          ),
          certifiedAttributeToDigest(certifiedAssignedAttributes),
          LIST_ITEMS
        ),
        revokedAttributes: combineAttributeDigests(
          await verifiedAttributeToDigest(
            verifiedRevokedAttributes,
            readModelService
          ),
          certifiedAttributeToDigest(certifiedRevokedAttributes),
          LIST_ITEMS
        ),
      };
    },

    hasDigestContent(data: TenantDigestData): boolean {
      return !!(
        data.newEservices?.totalCount ||
        data.updatedEservices?.totalCount ||
        data.updatedEserviceTemplates?.totalCount ||
        data.acceptedSentAgreements?.totalCount ||
        data.rejectedSentAgreements?.totalCount ||
        data.suspendedSentAgreements?.totalCount ||
        data.publishedSentPurposes?.totalCount ||
        data.rejectedSentPurposes?.totalCount ||
        data.waitingForApprovalSentPurposes?.totalCount ||
        data.waitingForApprovalReceivedAgreements?.totalCount ||
        data.publishedReceivedPurposes?.totalCount ||
        data.waitingForApprovalReceivedPurposes?.totalCount ||
        data.waitingForApprovalReceivedDelegations?.totalCount ||
        data.revokedReceivedDelegations?.totalCount ||
        data.receivedAttributes?.totalCount ||
        data.revokedAttributes?.totalCount
      );
    },
  };
}
