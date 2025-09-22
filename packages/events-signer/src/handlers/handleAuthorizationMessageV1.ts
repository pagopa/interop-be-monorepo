/* eslint-disable functional/immutable-data */
import { FileManager, logger } from "pagopa-interop-commons";
import {
  AuthorizationEventV1,
  CorrelationId,
  generateId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config } from "../config/config.js";
import { AuthorizationEventData } from "../models/eventTypes.js";
import { SafeStorageService } from "../services/safeStorageService.js";
import { processAndArchiveFiles } from "../utils/fileProcessor.js";

export const handleAuthorizationMessageV1 = async (
  eventsWithTimestamp: Array<{
    authV1: AuthorizationEventV1;
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
  const allAuthorizationDataToStore: AuthorizationEventData[] = [];

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

          allAuthorizationDataToStore.push({
            event_name: authV1.type,
            id: clientId,
            kid,
            user_id: userId,
            timestamp,
            eventTimestamp: kafkaMessageTimestamp,
            correlationId,
          });
        }
      })
      .with({ type: "KeyDeleted" }, (event) => {
        const clientId = event.data.clientId;
        const kid = event.data.keyId;
        const deactivationTimestamp = event.data.deactivationTimestamp;

        allAuthorizationDataToStore.push({
          event_name: authV1.type,
          id: clientId,
          kid,
          timestamp: deactivationTimestamp,
          eventTimestamp: kafkaMessageTimestamp,
          correlationId,
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
          loggerInstance.info(
            `Skipping not relevant event type: ${event.type}`
          );
        }
      )
      .exhaustive();
  }

  if (allAuthorizationDataToStore.length > 0) {
    await processAndArchiveFiles<AuthorizationEventData>(
      allAuthorizationDataToStore,
      loggerInstance,
      fileManager,
      dbService,
      safeStorage,
      correlationId
    );
  } else {
    loggerInstance.info("No authorization events to store.");
  }
};
