/* eslint-disable functional/immutable-data */
import { FileManager, Logger } from "pagopa-interop-commons";
import { AuthorizationEventV1 } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config, safeStorageApiConfig } from "../config/config.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export const handleAuthorizationMessageV1 = async (
  messages: AuthorizationEventV1[],
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allDataToStore: AuthorizationEventData[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "KeysAdded" }, (event) => {
        for (const key of event.data.keys) {
          const clientId = event.data.clientId;
          const kid = key.keyId;
          const userId = key.value?.userId;
          const timestamp = key.value?.createdAt;

          allDataToStore.push({
            event_name: event.type,
            id: clientId,
            kid,
            user_id: userId,
            timestamp,
          });
        }
      })
      .with({ type: "KeyDeleted" }, (event) => {
        const clientId = event.data.clientId;
        const kid = event.data.keyId;
        const timestamp = event.data.deactivationTimestamp;

        allDataToStore.push({
          event_name: event.type,
          id: clientId,
          kid,
          timestamp,
        });
      })
      .with(
        P.union(
          { type: "KeyRelationshipToUserMigrated" },
          { type: "ClientAdded" },
          { type: "ClientDeleted" },
          { type: "RelationshipAdded" },
          { type: "RelationshipRemoved" },
          { type: "UserAdded" },
          { type: "UserRemoved" },
          { type: "ClientPurposeAdded" },
          { type: "ClientPurposeRemoved" }
        ),
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allDataToStore.length > 0) {
    const timestamp = new Date();
    const documentDestinationPath = `authorization/events/${timestamp}`;

    const result = await storeNdjsonEventData(
      allDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );

    if (!result) {
      logger.info(`S3 storing didn't return a valid key or content`);
      return;
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
    logger.info("No authorization events to store.");
  }
};
