import { Logger } from "pagopa-interop-commons";

export async function processExitAndDisconnect({
  logger,
  onShutdown,
}: {
  logger: Logger;
  onShutdown?: () => Promise<void>;
}) {
  if (onShutdown) {
    await onShutdown();
    logger.debug("Shutdown hook completed successfully");
  }

  processExit({ logger });
}

function processExit({
  exitStatusCode = 1,
  logger,
}: {
  exitStatusCode?: number;
  logger: Logger;
}): never {
  logger.debug(`Process exit with code ${exitStatusCode}`);
  process.exit(exitStatusCode);
}
