import { match } from "ts-pattern";
import { AuthorizationEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleAuthorizationMessageV2 = async (
  decodedMessage: AuthorizationEventV2,
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  await match(decodedMessage)
    .with({ type: "ClientKeyAdded" }, async (event) => {
      logger.info(`Processing managed Authorization event: ${event.type}`);
      const clientId = event.data.client?.id;
      const kid = event.data.kid;
      const userId = JSON.stringify(event.data.client?.users);

      const dataToStore = {
        event_name: event.type,
        id: clientId,
        user_id: userId,
        kid,
      };

      const documentDestinationPath = `authorization/events/clients/${clientId}`;

      await storeEventDataInNdjson<AuthorizationEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .with({ type: "ClientKeyDeleted" }, async (event) => {
      logger.info(`Processing managed Authorization event: ${event.type}`);

      const clientId = event.data.client?.id;
      const kid = event.data.kid;

      const dataToStore = {
        event_name: event.type,
        id: clientId,
        kid,
      };

      const documentDestinationPath = `authorization/${clientId}`;

      await storeEventDataInNdjson<AuthorizationEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .with({ type: "ClientDeleted" }, async (event) => {
      logger.info(`Processing managed Authorization event: ${event.type}`);

      const clientId = event.data.client?.id;

      const dataToStore = {
        event_name: event.type,
        client_id: clientId,
      };

      const documentDestinationPath = `authorization/events/${clientId}`;

      await storeEventDataInNdjson<AuthorizationEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .otherwise(() => {
      logger.info(
        `Skipping unmanaged Authorization event: ${decodedMessage.type}`
      );
    });
};
