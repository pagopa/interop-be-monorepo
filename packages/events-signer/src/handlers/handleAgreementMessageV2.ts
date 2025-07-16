import { match, P } from "ts-pattern";
import { AgreementEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { AgreementEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleAgreementMessageV2 = async (
  decodedMessage: AgreementEventV2,
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  await match(decodedMessage)
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
      async (event) => {
        logger.info(`Processing managed Agreement event: ${event.type}`);

        const eventName = event.type;
        const id = event.data.agreement?.id;
        const state = event.data.agreement?.state;

        const dataToStore = {
          event_name: eventName,
          id,
          state,
        };

        const documentDestinationPath = `agreements/${id}`;

        await storeEventDataInNdjson<AgreementEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      }
    )
    .otherwise(() => {
      logger.info(`Skipping unmanaged Agreement event: ${decodedMessage.type}`);
    });
};
