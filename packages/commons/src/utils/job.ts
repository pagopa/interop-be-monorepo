import { Logger } from "../logging/index.js";
/**
 * Calls a function and logs the execution time.
 *
 * @param fn The function to call
 * @returns The result of the function
 */
export async function withExecutionTime(
  fn: () => void | Promise<void>,
  logger: Logger
): Promise<void> {
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  const executionTimeMs = t1 - t0;
  const executionTimeSeconds = Math.round((executionTimeMs / 1000) * 10) / 10;
  logger.info(`Execution time: ${executionTimeSeconds}s`);
}
