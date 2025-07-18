import { Buffer } from "buffer";
import { FileManager, Logger } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { StoreData } from "../models/storeData.js";
import { EventsSignerConfig } from "../config/config.js";

// TODO -> Change function handle zipping file
export const storeEventDataInNdjson = async <T extends StoreData>(
  dataToStoreArray: T[],
  documentDestinationPath: string,
  fileManager: FileManager,
  logger: Logger,
  config: EventsSignerConfig
): Promise<void> => {
  if (dataToStoreArray.length === 0) {
    logger.info("No data to store in NDJSON file.");
    return;
  }

  const ndjsonString =
    dataToStoreArray.map((data) => JSON.stringify(data)).join("\n") + "\n";
  const contentBuffer = Buffer.from(ndjsonString, "utf-8");

  const documentName = `events_${Date.now()}.ndjson`; // TODO -> document name scope should be on handlers

  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: documentDestinationPath,
        resourceId: generateId(), // TBD -> we could group events by id and use it as resourceId
        name: documentName,
        content: contentBuffer,
      },
      logger
    );
    logger.info(
      `Successfully stored ${dataToStoreArray.length} events in file ${documentName} at path ${documentDestinationPath}`
    );
  } catch (error) {
    logger.error(`Failed to store batch event data: ${error}`);
  }
};
