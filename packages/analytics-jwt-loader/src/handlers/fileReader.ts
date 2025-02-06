import { FileManager, Logger } from "pagopa-interop-commons";
import { config } from "../config/config.js";

export async function readFile(
  filePath: string,
  fileManager: FileManager,
  logger: Logger
): Promise<Buffer> {
  logger.info(`Reading file for path ${filePath}`);

  const documentBytes = await fileManager.get(
    config.s3Bucket,
    filePath,
    logger
  );

  return Buffer.from(documentBytes);
}
