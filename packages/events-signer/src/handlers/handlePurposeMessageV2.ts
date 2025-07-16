import { match, P } from "ts-pattern";
import {
  PurposeEventV2,
  PurposeId,
  PurposeStateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { PurposeEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handlePurposeMessageV2 = async (
  decodedMessage: PurposeEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  await match(decodedMessage)
    .with({ type: "PurposeAdded" }, async (event) => {
      logger.info(`Processing managed Purpose event: ${event.type}`);
      if (!event.data.purpose?.id) {
        throw new Error(`Purpose id can't be missing in event`);
      }

      const eventName = event.type;
      const id = unsafeBrandId<PurposeId>(event.data.purpose.id);
      const state = PurposeStateV2.DRAFT;
      const version = event.data.purpose?.versions[0];

      const dataToStore = {
        event_name: eventName,
        id,
        state,
      };

      const documentDestinationPath = `purposes/events/${id}/${version?.id}`;

      await storeEventDataInNdjson<PurposeEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .with({ type: "PurposeWaitingForApproval" }, async (event) => {
      logger.info(`Processing managed Purpose event: ${event.type}`);
      if (!event.data.purpose?.id) {
        throw new Error(`Purpose id can't be missing in event`);
      }
      const eventName = event.type;
      const id = event.data.purpose?.id;
      const state = PurposeStateV2.WAITING_FOR_APPROVAL;

      const dataToStore = {
        event_name: eventName,
        id,
        state,
      };

      const documentDestinationPath = `purposes/events/${id}`;

      await storeEventDataInNdjson<PurposeEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .with({ type: "PurposeActivated" }, async (event) => {
      logger.info(`Processing managed Purpose event: ${event.type}`);
      if (!event.data.purpose?.id) {
        throw new Error(`Purpose id can't be missing in event`);
      }

      const eventName = event.type;
      const id = event.data.purpose?.id;
      const state = PurposeStateV2.ACTIVE;
      const version = event.data.purpose?.versions[0];

      const dataToStore = {
        event_name: eventName,
        id,
        state,
      };

      const documentDestinationPath = `purposes/events/${id}/versions/${version?.id}`;

      await storeEventDataInNdjson<PurposeEventData>(
        dataToStore,
        documentDestinationPath,
        fileManager,
        logger,
        config
      );
    })
    .with({ type: "PurposeArchived" }, async (event) => {
      logger.info(`Processing managed Purpose event: ${event.type}`);

      const id = event.data.purpose?.id;
      const eventName = event.type;
      const versions = event.data.purpose?.versions || [];

      for (const version of versions) {
        const versionId = version.id;
        const state = PurposeStateV2.ARCHIVED;

        const dataToStore = {
          event_name: eventName,
          id,
          versionId,
          state,
        };

        const documentDestinationPath = `purposes/events/${id}/versions/${versionId}`;

        await storeEventDataInNdjson<PurposeEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      }
    })
    .with(
      {
        type: P.union(
          "NewPurposeVersionActivated",
          "NewPurposeVersionWaitingForApproval",
          "PurposeVersionActivated",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionRejected"
        ),
      },
      async (event) => {
        logger.info(`Processing managed Purpose Version event: ${event.type}`);

        const eventName = event.type;
        const id = event.data.purpose?.id;
        const versionId = event.data.versionId;

        const relevantVersion = event.data.purpose?.versions.find(
          (version) => version.id === versionId
        );
        const state = relevantVersion?.state;

        const dataToStore = {
          event_name: eventName,
          id,
          versionId,
          state,
        };

        const documentDestinationPath = `purposes/events/${id}/versions/${versionId}`;

        await storeEventDataInNdjson<PurposeEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      }
    )
    .otherwise(() => {
      logger.info(`Skipping unmanaged Purpose event: ${decodedMessage.type}`);
    });
};
