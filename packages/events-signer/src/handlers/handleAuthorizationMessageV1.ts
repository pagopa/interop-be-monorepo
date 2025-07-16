import { FileManager, Logger } from "pagopa-interop-commons";
import { AuthorizationEventV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DbServiceBuilder } from "../services/dbService.js";
import { config } from "../config/config.js";
import { AuthorizationEventData } from "../models/storeData.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";

export const handleAuthorizationMessageV2 = async (
  messages: AuthorizationEventV1[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  for (const message of messages) {
    match(message)
      .with({ type: "KeysAdded" }, async (event) => {
        for (const key of event.data.keys) {
          const clientId = event.data.clientId;
          const kid = key.keyId;
          const userId = key.value?.userId;
          const timestamp = key.value?.createdAt;

          const dataToStore = {
            // TBD
            event_name: event.type,
            id: clientId,
            kid,
            user_id: userId,
            timestamp,
          };

          const documentDestinationPath = `authorization/events/clients/${clientId}`;

          await storeEventDataInNdjson<AuthorizationEventData>(
            dataToStore,
            documentDestinationPath,
            fileManager,
            logger,
            config
          );
        }
      })
      .with({ type: "KeyDeleted" }, async (event) => {
        const clientId = event.data.clientId;
        const kid = event.data.keyId;
        const timestamp = event.data.deactivationTimestamp;

        const dataToStore = {
          event_name: event.type,
          id: clientId,
          kid,
          timestamp,
        };

        const documentDestinationPath = `authorization/events/clients/${clientId}`;

        await storeEventDataInNdjson<AuthorizationEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      });
  }
};
