/* eslint-disable functional/immutable-data */

import { FileManager, Logger } from "pagopa-interop-commons";
import { generateId, genericInternalError } from "pagopa-interop-models";
import { format } from "date-fns";
import { EventsSignerConfig } from "../config/config.js";
import { BaseEventData } from "../models/eventTypes.js";
import { compressJson } from "./compression.js";
import { groupEventsByDate } from "./groupEventsByDate.js";

export const storeNdjsonEventData = async <
  T extends BaseEventData & { eventTimestamp: string }
>(
  eventsToStoreArray: T[],
  fileManager: FileManager,
  logger: Logger,
  config: EventsSignerConfig
): Promise<
  | Array<{
      fileContentBuffer: Buffer;
      fileName: string;
    }>
  | undefined
> => {
  if (eventsToStoreArray.length === 0) {
    logger.info("No data to store in NDJSON file.");
    return;
  }

  const groupedEvents = groupEventsByDate(eventsToStoreArray);
  const results: Array<{
    fileContentBuffer: Buffer;
    fileName: string;
  }> = [];

  for (const [dateKey, group] of groupedEvents.entries()) {
    const [year, month, day] = dateKey.split("-");

    const ndjsonString =
      group.map((item) => JSON.stringify(item)).join("\n") + "\n";

    const fileContentBuffer = await compressJson(ndjsonString);

    const time = format(new Date(), "hhmmss");
    const fileName = `${year}${month}${day}_${time}_${generateId()}.ndjson.gz`;
    const filePath = `year=${year}/month=${month}/day=${day}`;

    try {
      const s3filePath = await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: filePath,
          resourceId: generateId(),
          name: fileName,
          content: fileContentBuffer,
        },
        logger
      );
      logger.info(
        `Successfully stored ${group.length} events for date ${dateKey} in file ${fileName} at path ${filePath}`
      );

      const s3KeyParts = s3filePath.split("/");
      const extractedFileName = s3KeyParts.pop();

      if (!extractedFileName) {
        throw new Error(
          `couldn't extract fileName from S3 path: ${s3filePath}`
        );
      }

      results.push({
        fileContentBuffer,
        fileName: extractedFileName,
      });
    } catch (error) {
      throw genericInternalError(
        `Failed to store batch event data for date ${dateKey}: ${error}`
      );
    }
  }
  return results.length > 0 ? results : undefined;
};
