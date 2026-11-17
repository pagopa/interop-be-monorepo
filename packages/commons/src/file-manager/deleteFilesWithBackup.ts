import { S3ServiceException } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

import { Logger } from "../logging/index.js";
import { FileManager } from "./fileManager.js";
import { FileManagerError } from "./fileManagerErrors.js";

type FileBackup = {
  path: string;
  backupPath: string;
};

type BackupContext = {
  fileManager: Pick<FileManager, "copy" | "delete">;
  bucket: string;
  logger: Logger;
};

async function backupFile(
  path: string,
  backupPrefix: string,
  { fileManager, bucket, logger }: BackupContext
): Promise<FileBackup | undefined> {
  try {
    const backupPath = await fileManager.copy(
      bucket,
      path,
      backupPrefix,
      "",
      path,
      logger
    );
    return { path, backupPath };
  } catch (error) {
    if (
      error instanceof FileManagerError &&
      error.cause instanceof S3ServiceException &&
      error.cause.name === "NoSuchKey"
    ) {
      logger.warn(
        `File s3://${bucket}/${path} is already absent; skipping deletion backup`
      );
      return undefined;
    }
    logger.error(
      `Error backing up s3://${bucket}/${path} to ${backupPrefix}/${path}: ${error}`
    );
    throw error;
  }
}

async function cleanupBackups(
  backups: FileBackup[],
  { fileManager, bucket, logger }: BackupContext
): Promise<void> {
  await Promise.all(
    backups.map(async ({ backupPath }) => {
      try {
        await fileManager.delete(bucket, backupPath, logger);
      } catch (error) {
        logger.error(
          `Error cleaning up deletion backup s3://${bucket}/${backupPath}; manual cleanup required: ${error}`
        );
      }
    })
  );
}

async function restoreBackups(
  backups: FileBackup[],
  { fileManager, bucket, logger }: BackupContext
): Promise<unknown[]> {
  const restoreResults = await Promise.allSettled(
    backups.map(async ({ path, backupPath }) => {
      try {
        await fileManager.copy(bucket, backupPath, "", "", path, logger);
      } catch (error) {
        logger.error(
          `Error restoring s3://${bucket}/${path} from s3://${bucket}/${backupPath}; backup retained for manual recovery: ${error}`
        );
        throw error;
      }
    })
  );
  return restoreResults.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
}

/**
 * Keeps server-side S3 backups until the operation succeeds, restoring files on failure.
 * Failed restorations retain all backups; failed cleanup is logged without undoing a commit.
 * This is synchronous best-effort compensation: crashes and ambiguous commits require
 * manual reconciliation using _delete-backups/<operation-id>/<original-key>.
 */
export async function deleteFilesWithBackup<T>(
  { paths, ...context }: BackupContext & { paths: readonly string[] },
  operation: () => Promise<T>
): Promise<T> {
  const { fileManager, bucket, logger } = context;
  const backupPrefix = `_delete-backups/${randomUUID()}`;
  const uniquePaths = [...new Set(paths)];
  const backupResults = await Promise.allSettled(
    uniquePaths.map((path) => backupFile(path, backupPrefix, context))
  );
  const backups = backupResults.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );

  const failedBackup = backupResults.find(
    (result) => result.status === "rejected"
  );
  if (failedBackup?.status === "rejected") {
    await cleanupBackups(backups, context);
    throw failedBackup.reason;
  }

  const deleteAndRunOperation = async (): Promise<T> => {
    try {
      // Wait for every delete before restoring: a failed request may have deleted its object.
      const deleteResults = await Promise.allSettled(
        uniquePaths.map((path) => fileManager.delete(bucket, path, logger))
      );
      const failedDelete = deleteResults.find(
        (deletion) => deletion.status === "rejected"
      );
      if (failedDelete?.status === "rejected") {
        throw failedDelete.reason;
      }
      return await operation();
    } catch (error) {
      const restoreErrors = await restoreBackups(backups, context);
      if (restoreErrors.length > 0) {
        throw new AggregateError(
          [error, ...restoreErrors],
          `File deletion failed and restoration is incomplete; backups retained at s3://${bucket}/${backupPrefix}/`,
          { cause: error }
        );
      }
      await cleanupBackups(backups, context);
      throw error;
    }
  };

  const result = await deleteAndRunOperation();
  // Cleanup errors must not roll back an operation whose event has already committed.
  await cleanupBackups(backups, context);
  return result;
}
