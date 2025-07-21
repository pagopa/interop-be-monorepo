/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  DelegationEventV2,
  fromDelegationV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { DelegationEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export const handleDelegationMessageV2 = async (
  decodedMessages: DelegationEventV2[],
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allDelegationDataToStore: DelegationEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with(
        {
          type: P.union(
            "ProducerDelegationApproved",
            "ProducerDelegationRevoked",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRevoked"
          ),
        },
        (event) => {
          if (!event.data.delegation?.id) {
            throw genericInternalError(
              `Skipping managed Delegation event ${event.type} due to missing delegation ID.`
            );
          }
          const delegation = fromDelegationV2(event.data.delegation);
          const eventName = event.type;
          const id = delegation.id;
          const state = delegation.state;

          allDelegationDataToStore.push({
            event_name: eventName,
            id,
            state,
          });
        }
      )
      .with(
        {
          type: P.union(
            "ProducerDelegationSubmitted",
            "ProducerDelegationRejected",
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationRejected"
          ),
        },
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allDelegationDataToStore.length > 0) {
    const timestamp = new Date();
    const documentDestinationPath = `delegations/${timestamp
      .toISOString()
      .slice(0, 10)}`;

    const result = await storeNdjsonEventData<DelegationEventData>(
      allDelegationDataToStore,
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
    logger.info("No managed delegation events to store.");
  }
};
