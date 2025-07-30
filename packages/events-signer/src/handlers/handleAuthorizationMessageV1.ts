/* eslint-disable functional/immutable-data */
import { FileManager, Logger } from "pagopa-interop-commons";
import {
  AuthorizationEventV1,
  genericInternalError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config, safeStorageApiConfig } from "../config/config.js";
import { AuthorizationEventData } from "../models/eventTypes.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { processStoredFilesForSafeStorage } from "../services/safeStorageArchivingService.js";

export const handleAuthorizationMessageV1 = async (
  eventsWithTimestamp: Array<{
    authV1: AuthorizationEventV1;
    timestamp: string;
  }>,
  logger: Logger,
  fileManager: FileManager,
  dbService: DbServiceBuilder,
  safeStorage: SafeStorageService
): Promise<void> => {
  const allDataToStore: AuthorizationEventData[] = [];

  for (const {
    authV1,
    timestamp: kafkaMessageTimestamp,
  } of eventsWithTimestamp) {
    match(authV1)
      .with({ type: "KeysAdded" }, (event) => {
        for (const key of event.data.keys) {
          const clientId = event.data.clientId;
          const kid = key.keyId;
          const userId = key.value?.userId;
          const timestamp = key.value?.createdAt;

          allDataToStore.push({
            event_name: authV1.type,
            id: clientId,
            kid,
            user_id: userId,
            timestamp,
            eventTimestamp: kafkaMessageTimestamp,
          });
        }
      })
      .with({ type: "KeyDeleted" }, (event) => {
        const clientId = event.data.clientId;
        const kid = event.data.keyId;
        const deactivationTimestamp = event.data.deactivationTimestamp;

        allDataToStore.push({
          event_name: authV1.type,
          id: clientId,
          kid,
          timestamp: deactivationTimestamp,
          eventTimestamp: kafkaMessageTimestamp,
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
    const storedFiles = await storeNdjsonEventData(
      allDataToStore,
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
    logger.info("Safe Storage reference saved in DynamoDB.");
  } else {
    logger.info("No authorization events to store.");
  }
};
