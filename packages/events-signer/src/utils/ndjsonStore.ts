import { Buffer } from "buffer";
import { FileManager, Logger } from "pagopa-interop-commons";
import { StoreData } from "../models/storeData.js";
import { EventsSignerConfig } from "../config/config.js";

export const storeEventDataInNdjson = async <T extends StoreData>(
  dataToStore: T,
  documentDestinationPath: string,
  fileManager: FileManager,
  logger: Logger,
  config: EventsSignerConfig
): Promise<void> => {
  const ndjsonString = JSON.stringify(dataToStore) + "\n";
  const contentBuffer = Buffer.from(ndjsonString, "utf-8");

  const documentName = `${dataToStore.event_name}_${Date.now()}.ndjson`;

  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: documentDestinationPath,
        resourceId: dataToStore.id,
        name: documentName,
        content: contentBuffer,
      },
      logger
    );
    logger.info(
      `Successfully stored event data for resource ID ${dataToStore.id} in file ${documentName}`
    );
  } catch (error) {
    logger.error(
      `Failed to store event data for ID ${dataToStore.id}: ${error}`
    );
  }
};
