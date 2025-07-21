import { FileManager, Logger } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { StoreData } from "../models/storeData.js";
import { EventsSignerConfig } from "../config/config.js";
import { compressJson } from "./compression.js";

export const storeNdjsonEventData = async <T extends StoreData>(
  dataToStoreArray: T[],
  documentDestinationPath: string,
  fileManager: FileManager,
  logger: Logger,
  config: EventsSignerConfig
): Promise<{ s3filePath: string; fileContentBuffer: Buffer } | undefined> => {
  if (dataToStoreArray.length === 0) {
    logger.info("No data to store in NDJSON file.");
    return;
  }

  const ndjsonString =
    dataToStoreArray.map((data) => JSON.stringify(data)).join("\n") + "\n";

  const fileContentBuffer = await compressJson(ndjsonString);

  const documentName = `events_${Date.now()}.ndjson`;

  try {
    const s3filePath = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: documentDestinationPath,
        resourceId: generateId(),
        name: documentName,
        content: fileContentBuffer,
      },
      logger
    );
    logger.info(
      `Successfully stored ${dataToStoreArray.length} events in file ${documentName} at path ${documentDestinationPath}`
    );
    return { s3filePath, fileContentBuffer };
  } catch (error) {
    logger.error(`Failed to store batch event data: ${error}`);
    throw error; // to do map error
  }
};
