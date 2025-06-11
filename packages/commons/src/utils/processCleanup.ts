/* eslint-disable no-console */
import { ReadModelRepository } from "../repositories/ReadModelRepository.js";
import { FileManager } from "../file-manager/fileManager.js";

export type CleanupResources = {
  fileManager?: FileManager;
  drizzleCleanup?: () => Promise<void>;
  additionalCleanups?: Array<() => Promise<void> | void>;
};

export async function gracefulShutdown(
  resources: CleanupResources,
  exitCode: number = 0
): Promise<void> {
  console.log("Starting graceful shutdown...");

  try {
    // Clean up ReadModel MongoDB connections
    await ReadModelRepository.cleanup();
    console.log("MongoDB connections closed");

    // Clean up file manager (S3 client)
    if (resources.fileManager) {
      resources.fileManager.cleanup();
      console.log("S3 client destroyed");
    }

    // Clean up Drizzle/PostgreSQL connections
    if (resources.drizzleCleanup) {
      await resources.drizzleCleanup();
      console.log("PostgreSQL connections closed");
    }

    // Clean up any additional resources
    if (resources.additionalCleanups) {
      for (const cleanup of resources.additionalCleanups) {
        await cleanup();
      }
      console.log("Additional cleanups completed");
    }

    console.log("Graceful shutdown completed");

    // Allow the process to exit naturally instead of forcing it
    // The process should now exit cleanly without hanging
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

export function setupGracefulShutdown(resources: CleanupResources): void {
  const shutdownHandler = (): void => {
    gracefulShutdown(resources).finally(() => {
      // If the process doesn't exit naturally after cleanup, force exit as fallback
      setTimeout(() => {
        console.warn("Process did not exit naturally, forcing exit");
        process.exit(0);
      }, 5000);
    });
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);
}
