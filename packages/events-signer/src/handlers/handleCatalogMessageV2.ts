/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  CorrelationId,
  EServiceEventV2,
  fromEServiceV2,
  generateId,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import {
  FileManager,
  logger,
  SafeStorageService,
  SignatureServiceBuilder,
} from "pagopa-interop-commons";
import { CatalogEventData } from "../models/eventTypes.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handleCatalogMessageV2 = async (
  eventsWithTimestamp: Array<{
    eserviceV2: EServiceEventV2;
    timestamp: Date;
  }>,
  fileManager: FileManager,
  signatureService: SignatureServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: "events-signer",
    correlationId,
  });
  const allCatalogDataToStore: CatalogEventData[] = [];
  for (const { eserviceV2, timestamp } of eventsWithTimestamp) {
    match(eserviceV2)
      .with(
        {
          type: P.union(
            "EServiceDescriptorAdded",
            "EServiceDescriptorActivated",
            "EServiceDescriptorArchived",
            "EServiceDescriptorPublished",
            "EServiceDescriptorSuspended",
            "EServiceDescriptorSubmittedByDelegate",
            "EServiceDescriptorApprovedByDelegator",
            "EServiceDescriptorRejectedByDelegator"
          ),
        },
        (event) => {
          if (!event.data.eservice?.id || !event.data.descriptorId) {
            throw missingKafkaMessageDataError("eserviceId", event.type);
          }
          const eservice = fromEServiceV2(event.data.eservice);
          const eventName = event.type;
          const eserviceId = eservice.id;
          const descriptorId = event.data.descriptorId;
          const state = eservice.descriptors.find(
            (descriptor) => descriptor.id === event.data.descriptorId
          )?.state;

          allCatalogDataToStore.push({
            event_name: eventName,
            id: eserviceId,
            descriptor_id: descriptorId,
            state,
            eventTimestamp: timestamp,
            correlationId,
          });
        }
      )
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceDeleted",
            "EServiceCloned",
            "EServiceDraftDescriptorUpdated",
            "EServiceDescriptorQuotasUpdated",
            "EServiceDescriptorAgreementApprovalPolicyUpdated",
            "EServiceDraftDescriptorDeleted",
            "EServiceDescriptorInterfaceAdded",
            "EServiceDescriptorDocumentAdded",
            "EServiceDescriptorInterfaceUpdated",
            "EServiceDescriptorDocumentUpdated",
            "EServiceDescriptorInterfaceDeleted",
            "EServiceDescriptorDocumentDeleted",
            "EServiceRiskAnalysisAdded",
            "EServiceRiskAnalysisUpdated",
            "EServiceRiskAnalysisDeleted",
            "EServiceDescriptionUpdated",
            "EServiceDescriptorAttributesUpdated",
            "EServiceIsConsumerDelegableEnabled",
            "EServiceIsConsumerDelegableDisabled",
            "EServiceIsClientAccessDelegableEnabled",
            "EServiceIsClientAccessDelegableDisabled",
            "EServiceNameUpdated",
            "EServiceNameUpdatedByTemplateUpdate",
            "EServiceDescriptionUpdatedByTemplateUpdate",
            "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
            "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentAddedByTemplateUpdate",
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentDeletedByTemplateUpdate",
            "EServiceSignalHubEnabled",
            "EServiceSignalHubDisabled",
            "EServicePersonalDataFlagUpdatedAfterPublication",
            "EServicePersonalDataFlagUpdatedByTemplateUpdate"
          ),
        },
        (event) => {
          loggerInstance.info(
            `Skipping not relevant event type: ${event.type}`
          );
        }
      )
      .exhaustive();
  }

  if (allCatalogDataToStore.length > 0) {
    await processAndArchiveFiles<CatalogEventData>(
      allCatalogDataToStore,
      loggerInstance,
      fileManager,
      signatureService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No managed catalog events to store.");
  }
};
