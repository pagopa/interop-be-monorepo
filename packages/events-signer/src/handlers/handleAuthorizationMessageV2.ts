/* eslint-disable functional/immutable-data */
import { P, match } from "ts-pattern";
import {
  AuthorizationEventV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { AuthorizationEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { FileCreationRequest } from "../models/safeStorageServiceSchema.js";
import { calculateSha256Base64 } from "../utils/checksum.js";

export const handleAuthorizationMessageV2 = async (
  decodedMessages: AuthorizationEventV2[],
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allAuthorizationDataToStore: AuthorizationEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with({ type: "ClientKeyAdded" }, (event) => {
        if (!event.data.client?.id) {
          logger.warn(
            `Skipping ClientKeyAdded event due to missing client ID.`
          );
          return;
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;
        const userId = JSON.stringify(event.data.client.users);

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          user_id: userId,
          kid,
        });
      })
      .with({ type: "ClientKeyDeleted" }, (event) => {
        if (!event.data.client?.id) {
          logger.warn(
            `Skipping ClientKeyDeleted event due to missing client ID.`
          );
          return;
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          kid,
        });
      })
      .with({ type: "ClientDeleted" }, (event) => {
        if (!event.data.client?.id) {
          logger.warn(`Skipping ClientDeleted event due to missing client ID.`);
          return;
        }

        const clientId = event.data.client.id;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
        });
      })
      .with(
        P.union(
          { type: "ClientAdded" },
          { type: "ClientAdminRoleRevoked" },
          { type: "ClientAdminRemoved" },
          { type: "ClientUserAdded" },
          { type: "ClientUserDeleted" },
          { type: "ClientAdminSet" },
          { type: "ClientPurposeAdded" },
          { type: "ClientPurposeRemoved" },
          { type: "ProducerKeychainAdded" },
          { type: "ProducerKeychainDeleted" },
          { type: "ProducerKeychainKeyAdded" },
          { type: "ProducerKeychainKeyDeleted" },
          { type: "ProducerKeychainUserAdded" },
          { type: "ProducerKeychainUserDeleted" },
          { type: "ProducerKeychainEServiceAdded" },
          { type: "ProducerKeychainEServiceRemoved" }
        ),
        (event) => {
          logger.info(`Skipping not relevant event type: ${event.type}`);
        }
      )
      .exhaustive();
  }

  if (allAuthorizationDataToStore.length > 0) {
    const timestamp = new Date();
    const documentDestinationPath = `authorization/${timestamp}`;

    const result = await storeNdjsonEventData<AuthorizationEventData>(
      allAuthorizationDataToStore,
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
    logger.info("No managed authorization events to store.");
  }
};
