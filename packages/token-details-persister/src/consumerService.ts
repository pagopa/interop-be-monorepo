import { Batch } from "kafkajs";
import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  Logger,
} from "pagopa-interop-commons";
import { generateId } from "pagopa-interop-models";
import { config } from "./config/config.js";

export async function handleBatch(
  batch: Batch,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  const fileContent =
    batch.messages
      .map((auditingEntry) => JSON.stringify(auditingEntry))
      .join("\n") + "\n";

  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimehhmmss(date);

  const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
  const filePath = `token-details/${ymdDate}/${fileName}`;

  try {
    await fileManager.storeBytes(
      {
        bucket: config.interopGeneratedJwtAuditingBucket,
        path: filePath,
        name: fileName,
        content: Buffer.from(fileContent),
      },
      logger
    );
    logger.info("auditing succeded");
  } catch (error) {
    throw Error("auditing failed");
  }
  return Promise.resolve();
}
