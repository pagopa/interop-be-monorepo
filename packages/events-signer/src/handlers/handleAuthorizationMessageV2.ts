/* eslint-disable functional/immutable-data */
import { match } from "ts-pattern";
import { AuthorizationEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleAuthorizationMessageV2 = async (
  decodedMessages: AuthorizationEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
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
      .otherwise((event) => {
        logger.info(`Skipping unmanaged Authorization event: ${event.type}`);
      });
  }

  if (allAuthorizationDataToStore.length > 0) {
    const documentDestinationPath = `authorization/${new Date()}`;

    await storeEventDataInNdjson<AuthorizationEventData>(
      allAuthorizationDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  } else {
    logger.info("No managed authorization events to store.");
  }
};
