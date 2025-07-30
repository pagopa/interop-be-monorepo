/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  EServiceEventV2,
  fromEServiceV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { CatalogEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { processStoredFilesForSafeStorage } from "../services/safeStorageArchivingService.js";

export const handleCatalogMessageV2 = async (
  eventsWithTimestamp: Array<{
    eserviceV2: EServiceEventV2;
    timestamp: string;
  }>,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allCatalogDataToStore: CatalogEventData[] = [];
  for (const { eserviceV2, timestamp } of eventsWithTimestamp) {
    match(eserviceV2)
      .with(
        {
          type: P.union(
            "EServiceDescriptorActivated",
            "EServiceDescriptorArchived",
            "EServiceDescriptorPublished",
            "EServiceDescriptorSuspended"
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
            "EServiceDescriptorAdded",
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
            "EServiceDescriptorSubmittedByDelegate",
            "EServiceDescriptorApprovedByDelegator",
            "EServiceDescriptorRejectedByDelegator",
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
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allCatalogDataToStore.length > 0) {
    const storedFiles = await storeNdjsonEventData<CatalogEventData>(
      allCatalogDataToStore,
      fileManager,
      logger,
      config
    );

    if (storedFiles.length === 0) {
      throw genericInternalError(
        `S3 storing didn't return a valid key or content`
      );
    }

    await processStoredFilesForSafeStorage(
      storedFiles,
      logger,
      dbService,
      safeStorage,
      safeStorageApiConfig
    );
  } else {
    logger.info("No managed catalog events to store.");
  }
};
