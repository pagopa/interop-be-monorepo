import { match, P } from "ts-pattern";
import { EServiceEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { CatalogEventData } from "../models/storeData.js";

export const handleCatalogMessageV2 = async (
  decodedMessage: EServiceEventV2,
  logger: Logger,
  fileManager: FileManager
): Promise<void> => {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceDescriptorActivated",
          "EServiceDescriptorArchived",
          "EServiceDescriptorPublished",
          "EServiceDescriptorSuspended"
        ),
      },
      async (event) => {
        logger.info(`Processing managed Catalog event: ${event.type}`);

        const eventName = event.type;
        const eserviceId = event.data.eservice?.id;
        const descriptorId = event.data.descriptorId;

        const state = event.data.eservice?.descriptors.find(
          (descriptor) => descriptor.id === event.data.descriptorId
        )?.state;

        const dataToStore = {
          event_name: eventName,
          id: eserviceId,
          descriptor_id: descriptorId,
          state,
        };

        const documentDestinationPath = `catalog/eservices/${eserviceId}/${descriptorId}`;

        await storeEventDataInNdjson<CatalogEventData>(
          dataToStore,
          documentDestinationPath,
          fileManager,
          logger,
          config
        );
      }
    )
    .otherwise(() => {
      logger.info(`Skipping unmanaged Catalog event: ${decodedMessage.type}`);
    });
};
