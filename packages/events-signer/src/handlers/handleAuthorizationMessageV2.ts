/* eslint-disable functional/immutable-data */
import { P, match } from "ts-pattern";
import {
  AuthorizationEventV2,
  genericInternalError,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config, safeStorageApiConfig } from "../config/config.js";
import { prepareNdjsonEventData } from "../utils/ndjsonStore.js";
import { AuthorizationEventData } from "../models/eventTypes.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { archiveFileToSafeStorage } from "../services/safeStorageArchivingService.js";
import { uploadPreparedFileToS3 } from "../utils/s3Uploader.js";

export const handleAuthorizationMessageV2 = async (
  eventsWithTimestamp: Array<{
    authV2: AuthorizationEventV2;
    timestamp: string;
  }>,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allAuthorizationDataToStore: AuthorizationEventData[] = [];

  for (const { authV2, timestamp } of eventsWithTimestamp) {
    match(authV2)
      .with({ type: "ClientKeyAdded" }, (event) => {
        if (!event.data.client?.id) {
          throw genericInternalError(
            `Skipping ClientKeyAdded event due to missing client ID.`
          );
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;
        const userId = JSON.stringify(event.data.client.users);

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          user_id: userId,
          kid,
          eventTimestamp: timestamp,
        });
      })
      .with({ type: "ClientKeyDeleted" }, (event) => {
        if (!event.data.client?.id) {
          throw genericInternalError(
            `Client id cannot be missing on event ${event.type}`
          );
        }

        const clientId = event.data.client.id;
        const kid = event.data.kid;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          kid,
          eventTimestamp: timestamp,
        });
      })
      .with({ type: "ClientDeleted" }, (event) => {
        if (!event.data.client?.id) {
          throw new Error(`Client id cannot be missing on event ${event.type}`);
        }

        const clientId = event.data.client.id;

        allAuthorizationDataToStore.push({
          event_name: event.type,
          id: clientId,
          eventTimestamp: timestamp,
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
    const preparedFiles = await prepareNdjsonEventData<AuthorizationEventData>(
      allAuthorizationDataToStore,
      logger
    );

    if (preparedFiles.length === 0) {
      throw genericInternalError(`NDJSON preparation didn't return any files.`);
    }

    for (const preparedFile of preparedFiles) {
      const result = await uploadPreparedFileToS3(
        preparedFile,
        fileManager,
        logger,
        config
      );
      await archiveFileToSafeStorage(
        result,
        logger,
        dbService,
        safeStorage,
        safeStorageApiConfig
      );
    }
  } else {
    logger.info("No managed authorization events to store.");
  }
};
