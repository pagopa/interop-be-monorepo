import crypto from "crypto";
import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  Logger,
} from "pagopa-interop-commons";
import { KafkaMessage } from "kafkajs";
import { config } from "./config/config.js";

export async function handleMessages(
  messages: KafkaMessage[],
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  const fileContent = messages.map((message) => message.value).join("\n");

  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimehhmmss(date);

  // TODO only for testing. Revert to generateId()
  const hash = crypto.createHash("md5").update(fileContent).digest("hex");
  const fileName = `${ymdDate}_${hmsTime}_${hash}.ndjson`;
  const filePath = `token-details/${ymdDate}`;
  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: filePath,
        name: fileName,
        content: Buffer.from(fileContent),
      },
      logger
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "generic error";
    throw Error(`Write operation failed - ${message}`);
  }
}
