/* eslint-disable functional/immutable-data */
import { FileManager, Logger } from "pagopa-interop-commons";
import { AuthorizationEventV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config } from "../config/config.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";

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
      .otherwise(() => {
        logger.warn(`Unhandled event type: ${message.type}`);
      });
  }

  if (allDataToStore.length > 0) {
    const documentDestinationPath = `authorization/events/${new Date()}`;
    await storeEventDataInNdjson(
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
