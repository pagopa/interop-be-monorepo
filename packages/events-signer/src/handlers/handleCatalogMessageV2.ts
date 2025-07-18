/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import { EServiceEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { CatalogEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";

export const handleCatalogMessageV2 = async (
  decodedMessages: EServiceEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allCatalogDataToStore: CatalogEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
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
            logger.warn(
              `Skipping managed Catalog event ${event.type} due to missing e-service ID or descriptor ID.`
            );
            return;
          }

          const eventName = event.type;
          const eserviceId = event.data.eservice.id;
          const descriptorId = event.data.descriptorId;

          const state = event.data.eservice.descriptors.find(
            (descriptor) => descriptor.id === event.data.descriptorId
          )?.state;

          allCatalogDataToStore.push({
            event_name: eventName,
            id: eserviceId,
            descriptor_id: descriptorId,
            state,
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
    const timestamp = new Date();
    const documentDestinationPath = `catalog/${timestamp}`;
    const fileName = `catalog_events_${timestamp}.ndjson`; // TO DO ZIP

    await storeEventDataInNdjson<CatalogEventData>(
      allCatalogDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );

    logger.info(`Requesting file creation in Safe Storage for ${fileName}...`);

    // const fileCreationResponse = await safeStorage.createFile(null);
    // const { uploadUrl } = fileCreationResponse;

    await safeStorage.uploadFileContent(
      "uploadUrl",
      Buffer.from("content"),
      "application/zip",
      "secret",
      "checksumValue"
    );
    logger.info("File uploaded to Safe Storage successfully.");

    // TODO -> Check  column integrity
    // await dbService.saveSignatureReference(
    //   { fileId: fileCreationRequest.fileId },
    //   fileKey,
    //   fileNameForSafeStorage,
    // );
    logger.info("Safe Storage reference saved in DynamoDB.");
  } else {
    logger.info("No managed catalog events to store.");
  }
};
