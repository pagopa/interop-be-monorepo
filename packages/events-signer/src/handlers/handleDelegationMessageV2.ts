/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import { DelegationEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { DelegationEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleDelegationMessageV2 = async (
  decodedMessages: DelegationEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  const allDelegationDataToStore: DelegationEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with(
        {
          type: P.union(
            "ProducerDelegationApproved",
            "ProducerDelegationRevoked",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRevoked"
          ),
        },
        (event) => {
          if (!event.data.delegation?.id) {
            logger.warn(
              `Skipping managed Delegation event ${event.type} due to missing delegation ID.`
            );
            return;
          }

          const eventName = event.type;
          const id = event.data.delegation.id;
          const state = event.data.delegation.state;

          allDelegationDataToStore.push({
            event_name: eventName,
            id,
            state,
          });
        }
      )
      .otherwise((event) => {
        logger.info(`Skipping unmanaged Delegation event: ${event.type}`);
      });
  }

  if (allDelegationDataToStore.length > 0) {
    const documentDestinationPath = `delegations/${new Date()
      .toISOString()
      .slice(0, 10)}`;

    await storeEventDataInNdjson<DelegationEventData>(
      allDelegationDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  } else {
    logger.info("No managed delegation events to store.");
  }
};
