/* eslint-disable functional/immutable-data */

import { match, P } from "ts-pattern";
import { AgreementEventV2, genericInternalError } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { AgreementEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export const handleAgreementMessageV2 = async (
  decodedMessages: AgreementEventV2[],
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allAgreementDataToStore: AgreementEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with(
        {
          type: P.union(
            "AgreementSubmitted",
            "AgreementRejected",
            "AgreementActivated",
            "AgreementSuspendedByProducer",
            "AgreementSuspendedByConsumer",
            "AgreementSuspendedByPlatform",
            "AgreementUnsuspendedByProducer",
            "AgreementUnsuspendedByConsumer",
            "AgreementUnsuspendedByPlatform",
            "AgreementArchivedByUpgrade",
            "AgreementArchivedByConsumer"
          ),
        },
        (event) => {
          if (!event.data.agreement?.id) {
            logger.warn(
              `Skipping managed Agreement event ${event.type} due to missing agreement ID.`
            );
            return;
          }

          const eventName = event.type;
          const id = event.data.agreement.id;
          const state = event.data.agreement.state;

          allAgreementDataToStore.push({
            event_name: eventName,
            id,
            state,
          });
        }
      )
      .with(
        {
          type: P.union(
            "AgreementAdded",
            "AgreementDeleted",
            "DraftAgreementUpdated",
            "AgreementUpgraded",
            "AgreementConsumerDocumentAdded",
            "AgreementConsumerDocumentRemoved",
            "AgreementSetDraftByPlatform",
            "AgreementSetMissingCertifiedAttributesByPlatform",
            "AgreementDeletedByRevokedDelegation",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allAgreementDataToStore.length > 0) {
    const timestamp = new Date();
    const documentDestinationPath = `agreements/${timestamp}`;

    const result = await storeNdjsonEventData<AgreementEventData>(
      allAgreementDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );

    if (!result) {
      throw genericInternalError(
        `S3 storing didn't return a valid key or content`
      );
    }

    const { fileContentBuffer, s3PresignedUrl, fileName } = result;

    const checksum = await calculateSha256Base64(fileContentBuffer);

    logger.info(
      `Requesting file creation in Safe Storage for ${s3PresignedUrl}...`
    );

    const safeStorageRequest: FileCreationRequest = {
      contentType: "application/json",
      documentType: safeStorageApiConfig.safeStorageDocType,
      status: safeStorageApiConfig.safeStorageDocStatus,
      checksumValue: checksum,
    };

    const { uploadUrl, secret, key } = await safeStorage.createFile(
      safeStorageRequest
    );

    await safeStorage.uploadFileContent(
      uploadUrl,
      fileContentBuffer,
      "application/json",
      secret,
      checksum
    );

    logger.info("File uploaded to Safe Storage successfully.");

    await dbService.saveSignatureReference({
      safeStorageId: key,
      fileKind: "PLATFORM_EVENTS",
      fileName,
    });
    logger.info("Safe Storage reference saved in DynamoDB.");
  } else {
    logger.info("No managed agreement events to store.");
  }
};
