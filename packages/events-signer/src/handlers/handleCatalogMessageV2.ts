/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  CorrelationId,
  EServiceEventV2,
  fromEServiceV2,
  generateId,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import { CatalogEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { archiveFileToSafeStorage } from "./safeStorageArchivingHandler.js";
import { uploadPreparedFileToS3 } from "./s3UploaderHandler.js";

export const handleCatalogMessageV2 = async (
  eventsWithTimestamp: Array<{
    eserviceV2: EServiceEventV2;
    timestamp: string;
  }>,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const correlationId = generateId<CorrelationId>();

  const loggerInstance = logger({
    serviceName: config.serviceName,
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
            throw genericInternalError(
              `Skipping managed Catalog event ${event.type} due to missing e-service ID or descriptor ID.`
            );
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
            "EServiceSignalHubDisabled"
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
    const preparedFiles = await prepareNdjsonEventData<CatalogEventData>(
      allCatalogDataToStore,
      loggerInstance
    );

    if (preparedFiles.length === 0) {
      throw genericInternalError(`NDJSON preparation didn't return any files.`);
    }

    for (const preparedFile of preparedFiles) {
      const result = await uploadPreparedFileToS3(
        preparedFile,
        fileManager,
        loggerInstance,
        config
      );
      await archiveFileToSafeStorage(
        result,
        loggerInstance,
        dbService,
        safeStorage,
        safeStorageApiConfig,
        correlationId
      );
    }
  } else {
    loggerInstance.info("No managed catalog events to store.");
  }
};
