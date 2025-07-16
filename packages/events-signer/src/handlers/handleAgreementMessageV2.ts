/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import { AgreementEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { AgreementEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";

export const handleAgreementMessageV2 = async (
  decodedMessages: AgreementEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  const allAgreementDataToStore: AgreementEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with(
        {
          type: P.union(
            "AgreementSubmitted",
            "AgreementRejected",
            "AgreementActivated",
            "AgreementSuspendedByProducer",
            "AgreementSuspendedByConsumer",
            "AgreementSuspendedByPlatform",
            "AgreementUnsuspendedByProducer",
            "AgreementUnsuspendedByConsumer",
            "AgreementUnsuspendedByPlatform",
            "AgreementArchivedByUpgrade",
            "AgreementArchivedByConsumer"
          ),
        },
        (event) => {
          if (!event.data.agreement?.id) {
            logger.warn(
              `Skipping managed Agreement event ${event.type} due to missing agreement ID.`
            );
            return;
          }

          const eventName = event.type;
          const id = event.data.agreement.id;
          const state = event.data.agreement.state;

          allAgreementDataToStore.push({
            event_name: eventName,
            id,
            state,
          });
        }
      )
      .otherwise((event) => {
        logger.info(`Skipping unmanaged Agreement event: ${event.type}`);
      });
  }

  if (allAgreementDataToStore.length > 0) {
    const documentDestinationPath = `agreements/${new Date()}`;
    await storeEventDataInNdjson<AgreementEventData>(
      allAgreementDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  } else {
    logger.info("No managed agreement events to store.");
  }
};
