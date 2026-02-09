import { Logger } from "pagopa-interop-commons";
import {
  agreementState,
  TenantId,
  unsafeBrandId,
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
  viewAllNewUpdatedEservicesLink,
  viewAllSentAgreementsLink,
  viewAllSentPurposesLink,
  viewAllReceivedAgreementsLink,
  viewAllReceivedPurposesLink,
  viewAllSentDelegationsLink,
  viewAllReceivedDelegationsLink,
  viewAllAttributesLink,
  viewAllUpdatedEserviceTemplatesLink,
  viewAllPopularEserviceTemplatesLink,
  notificationSettingsLink,
} from "./deeplinkBuilder.js";
import { NewEservice, ReadModelService } from "./readModelService.js";
import { SimpleCache } from "./simpleCache.js";

const PRIORITY_PRODUCER_IDS: TenantId[] = [
  "bce8d16d-d26f-4c35-a835-35cca48ff8a5", // Agenzia delle Entrate
  "2a9ad360-90ef-4499-ab2c-112b0fbcecc7", // Ministero dell'Interno
  "53b40136-65f2-424b-acfb-7fae17e35c60", // Istituto Nazionale Previdenza Sociale - INPS
  "27aaf0d7-850b-4aca-92b8-f4df70217448", // MINISTERO DELL'UNIVERSITA' E DELLA RICERCA
  "86a2adeb-bf90-4248-b471-58ba3539f423", // Ministero dell'istruzione e del merito
  "6c07e769-b418-4210-bc0f-7d56470a06e9", // Ministero delle infrastrutture e dei trasporti
  "2e1c950b-26d6-471a-b5ec-bd233d5b1f07", // Ministero del Lavoro e delle Politiche Sociali
  "87ac321d-f13f-49f3-8aa8-2aaae9dc2115", // Dipartimento della Funzione Pubblica
].map(unsafeBrandId<TenantId>);

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
  notificationSettingsLink: string;
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
    priorityProducerIds: TenantId[],
    selfcareId: string | null
  ): Promise<BaseDigest> {
    logger.info("Building new e-services digest");

    const cachedData = newEservicesCache.get();
    if (cachedData !== null) {
      logger.info("Cache hit - using cached new e-services data");
      return eserviceToBaseDigest(cachedData, readModelService, selfcareId);
    }

    // Cache miss - fetch from database
    logger.info("Cache miss - fetching new e-services from database");
    const fetchedData = await readModelService.getNewEservices(
      priorityProducerIds
    );

    // Store in cache
    newEservicesCache.set(fetchedData);
    return eserviceToBaseDigest(fetchedData, readModelService, selfcareId);
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
        tenantDataMap,
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

      const tenantData = tenantDataMap.get(tenantId);
      const tenantName = tenantData?.name ?? "Tenant Name Placeholder";
      const selfcareId = tenantData?.selfcareId ?? null;

      // Fetch new e-services with selfcareId (needs to be after we have selfcareId)
      const newEservices = await getNewEservicesDigest(
        PRIORITY_PRODUCER_IDS,
        selfcareId
      );

      return {
        tenantId,
        tenantName,
        timePeriod: "Time Period Placeholder",
        notificationSettingsLink: notificationSettingsLink(selfcareId),
        viewAllNewEservicesLink: viewAllNewUpdatedEservicesLink(selfcareId),
        viewAllUpdatedEservicesLink: viewAllNewUpdatedEservicesLink(selfcareId),
        viewAllSentAgreementsLink: viewAllSentAgreementsLink(selfcareId),
        viewAllSentPurposesLink: viewAllSentPurposesLink(selfcareId),
        viewAllReceivedAgreementsLink:
          viewAllReceivedAgreementsLink(selfcareId),
        viewAllReceivedPurposesLink: viewAllReceivedPurposesLink(selfcareId),
        viewAllSentDelegationsLink: viewAllSentDelegationsLink(selfcareId),
        viewAllReceivedDelegationsLink:
          viewAllReceivedDelegationsLink(selfcareId),
        viewAllAttributesLink: viewAllAttributesLink(selfcareId),
        viewAllUpdatedEserviceTemplatesLink:
          viewAllUpdatedEserviceTemplatesLink(selfcareId),
        viewAllPopularEserviceTemplatesLink:
          viewAllPopularEserviceTemplatesLink(selfcareId),
        newEservices,
        updatedEservices: await eserviceToBaseDigest(
          updatedEservices,
          readModelService,
          selfcareId
        ),
        updatedEserviceTemplates: await eserviceTemplateToBaseDigest(
          updatedEserviceTemplates,
          readModelService,
          selfcareId
        ),
        popularEserviceTemplates: await popularEserviceTemplateToBaseDigest(
          popularEserviceTemplates,
          readModelService,
          selfcareId
        ),
        acceptedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.active,
          readModelService,
          selfcareId
        ),
        rejectedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.rejected,
          readModelService,
          selfcareId
        ),
        suspendedSentAgreements: await sentAgreementsToBaseDigest(
          sentAgreements,
          agreementState.suspended,
          readModelService,
          selfcareId
        ),
        publishedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.active,
          selfcareId
        ),
        rejectedSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.rejected,
          selfcareId
        ),
        waitingForApprovalSentPurposes: sentPurposesToBaseDigest(
          sentPurposes,
          purposeVersionState.waitingForApproval,
          selfcareId
        ),
        waitingForApprovalReceivedAgreements:
          await receivedAgreementsToBaseDigest(
            receivedAgreements,
            readModelService,
            selfcareId
          ),
        publishedReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.active,
          selfcareId
        ),
        waitingForApprovalReceivedPurposes: receivedPurposesToBaseDigest(
          receivedPurposes,
          purposeVersionState.waitingForApproval,
          selfcareId
        ),
        activeSentDelegations: await sentDelegationsToDigest(
          sentDelegations,
          delegationState.active,
          readModelService,
          selfcareId
        ),
        rejectedSentDelegations: await sentDelegationsToDigest(
          sentDelegations,
          delegationState.rejected,
          readModelService,
          selfcareId
        ),
        waitingForApprovalReceivedDelegations:
          await receivedDelegationsToDigest(
            receivedDelegations,
            delegationState.waitingForApproval,
            readModelService,
            selfcareId
          ),
        revokedReceivedDelegations: await receivedDelegationsToDigest(
          receivedDelegations,
          delegationState.revoked,
          readModelService,
          selfcareId
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
