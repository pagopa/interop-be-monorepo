/* eslint-disable functional/immutable-data */

import { Logger } from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { format } from "date-fns";
import { BaseEventData } from "../models/eventTypes.js";
import { compressJson } from "./compression.js";
import { groupEventsByDate } from "./groupEventsByDate.js";

export type PreparedNdjsonFile = {
  fileContentBuffer: Buffer;
  fileName: string;
  filePath: string;
  resourceId: string;
};

export const prepareNdjsonEventData = async <
  T extends BaseEventData & { eventTimestamp: string }
>(
  eventsToStoreArray: T[],
  logger: Logger
): Promise<PreparedNdjsonFile[]> => {
  if (eventsToStoreArray.length === 0) {
    logger.info("No data to store in NDJSON file.");
    return [];
  }

  const groupedEvents = groupEventsByDate(eventsToStoreArray);
  const results: PreparedNdjsonFile[] = [];

  for (const [dateKey, group] of groupedEvents.entries()) {
    const [year, month, day] = dateKey.split("-");

    const ndjsonString =
      group.map((item) => JSON.stringify(item)).join("\n") + "\n";

    const fileContentBuffer = await compressJson(ndjsonString);

    const time = format(new Date(), "hhmmss");
    const fileName = `${year}${month}${day}_${time}_${generateId()}.ndjson.gz`;
    const filePath = `year=${year}/month=${month}/day=${day}`;
    const resourceId = generateId();

    results.push({
      fileContentBuffer,
      fileName,
      filePath,
      resourceId,
    });
  }
  return results;
};
