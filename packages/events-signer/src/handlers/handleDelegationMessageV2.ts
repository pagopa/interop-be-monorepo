import { match, P } from "ts-pattern";
import { DelegationEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { DelegationEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleDelegationMessageV2 = async (
  decodedMessage: DelegationEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ProducerDelegationRevoked",
          "ConsumerDelegationApproved",
          "ConsumerDelegationRevoked"
        ),
      },
      async (event) => {
        logger.info(`Processing managed Delegation event: ${event.type}`);

        const eventName = event.type;
        const id = event.data.delegation?.id;
        const state = event.data.delegation?.state;

        const dataToStore = {
          event_name: eventName,
          id,
          state,
        };

        const documentDestinationPath = `delegations/${id}`;

        await storeEventDataInNdjson<DelegationEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      }
    )
    .otherwise(() => {
      logger.info(
        `Skipping unmanaged Delegation event: ${decodedMessage.type}`
      );
    });
};
