import { Logger } from "../logging/index.js";
import { ReadModelRepository } from "../repositories/ReadModelRepository.js";

export async function cleanupResources(
  loggerInstance: Logger,
  drizzleCleanup?: () => Promise<void>
): Promise<void> {
  // Clean up resources that prevent process exit
  loggerInstance.info("Cleaning up resources...");

  // Close MongoDB connections
  await ReadModelRepository.cleanup();

  // Close PostgreSQL pool connections
  if (drizzleCleanup) {
    await drizzleCleanup();
  }

  loggerInstance.info("Cleanup completed!");
}
