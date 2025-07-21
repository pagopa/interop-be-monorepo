/* eslint-disable functional/immutable-data */
import { FileManager, Logger } from "pagopa-interop-commons";
import { AuthorizationEventV1 } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config } from "../config/config.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { storeNdjsonEventData } from "../utils/ndjsonStore.js";

export const handleAuthorizationMessageV1 = async (
  messages: AuthorizationEventV1[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
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
    const documentDestinationPath = `authorization/events/${new Date()}`;
    await storeNdjsonEventData(
      allDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  } else {
    logger.info("No authorization events to store.");
  }
};
