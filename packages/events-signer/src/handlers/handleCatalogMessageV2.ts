/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import { EServiceEventV2 } from "pagopa-interop-models";
import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";
import { storeEventDataInNdjson } from "../utils/ndjsonStore.js";
import { CatalogEventData } from "../models/storeData.js";
import { DbServiceBuilder } from "../services/dbService.js";

export const handleCatalogMessageV2 = async (
  decodedMessages: EServiceEventV2[],
  logger: Logger,
  fileManager: FileManager,
  _dbService: DbServiceBuilder
): Promise<void> => {
  const allCatalogDataToStore: CatalogEventData[] = [];

  for (const message of decodedMessages) {
    match(message)
      .with(
        {
          type: P.union(
            "EServiceDescriptorActivated",
            "EServiceDescriptorArchived",
            "EServiceDescriptorPublished",
            "EServiceDescriptorSuspended"
          ),
        },
        (event) => {
          if (!event.data.eservice?.id || !event.data.descriptorId) {
            logger.warn(
              `Skipping managed Catalog event ${event.type} due to missing e-service ID or descriptor ID.`
            );
            return;
          }

          const eventName = event.type;
          const eserviceId = event.data.eservice.id;
          const descriptorId = event.data.descriptorId;

          const state = event.data.eservice.descriptors.find(
            (descriptor) => descriptor.id === event.data.descriptorId
          )?.state;

          allCatalogDataToStore.push({
            event_name: eventName,
            id: eserviceId,
            descriptor_id: descriptorId,
            state,
          });
        }
      )
      .otherwise((event) => {
        logger.info(`Skipping unmanaged Catalog event: ${event.type}`);
      });
  }

  if (allCatalogDataToStore.length > 0) {
    const documentDestinationPath = `catalog/${new Date()}`;

    await storeEventDataInNdjson<CatalogEventData>(
      allCatalogDataToStore,
      documentDestinationPath,
      fileManager,
      logger,
      config
    );
  } else {
    logger.info("No managed catalog events to store.");
  }
};
