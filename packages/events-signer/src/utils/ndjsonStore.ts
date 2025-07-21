/* eslint-disable functional/immutable-data */

import { FileManager, Logger } from "pagopa-interop-commons";
import { generateId, genericInternalError } from "pagopa-interop-models";
import { StoreData } from "../models/storeData.js";
import { EventsSignerConfig } from "../config/config.js";
import { compressJson } from "./compression.js";

export const storeNdjsonEventData = async <T extends StoreData>(
  dataToStoreArray: T[],
  documentDestinationPath: string,
  fileManager: FileManager,
  logger: Logger,
  config: EventsSignerConfig
): Promise<
  | {
      fileContentBuffer: Buffer;
      s3PresignedUrl: string;
      fileName: string;
    }
  | undefined
> => {
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
    const s3KeyParts = s3filePath.split("/");
    const fileName = s3KeyParts.pop();
    const s3PathWithoutFileName = s3KeyParts.join("/");

    if (!fileName) {
      throw new Error(`couldn't extract fileName`);
    }

    const s3PresignedUrl = await fileManager.generateGetPresignedUrl(
      config.s3Bucket,
      s3PathWithoutFileName,
      fileName,
      1
    );
    return { fileContentBuffer, s3PresignedUrl, fileName };
  } catch (error) {
    throw genericInternalError(`Failed to store batch event data: ${error}`); // to do map error
  }
};
