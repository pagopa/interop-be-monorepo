import { Logger } from "../logging/index.js";
import { FileManager } from "./fileManager.js";

/**
 * Best-effort cleanup to run only after the domain events have been persisted.
 * Failed deletions are logged for manual cleanup without failing the committed operation.
 */
export async function deleteFiles({
  fileManager,
  bucket,
  paths,
  logger,
}: {
  fileManager: Pick<FileManager, "delete">;
  bucket: string;
  paths: readonly string[];
  logger: Logger;
}): Promise<void> {
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      try {
        await fileManager.delete(bucket, path, logger);
      } catch (error) {
        logger.error(
          `Error deleting s3://${bucket}/${path} after event persistence; manual cleanup required: ${error}`
        );
      }
    })
  );
}
