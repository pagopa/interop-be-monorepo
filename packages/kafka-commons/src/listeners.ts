import type {
  Consumer,
  Producer,
} from "@confluentinc/kafka-javascript/types/kafkajs.js";
import { processExitAndDisconnect } from "./utils/utils.js";
import { Logger } from "pagopa-interop-commons";

const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

export function errorEventsListener(
  consumerOrProducer: Consumer | Producer,
  logger: Logger,
  onShutdown?: () => Promise<void>
): void {
  errorTypes.forEach((type) => {
    process.on(
      type,
      async (e) =>
        await handleExit(e, type, consumerOrProducer, logger, onShutdown)
    );
  });

  signalTraps.forEach((type) => {
    process.once(
      type,
      async () =>
        await handleExit(null, type, consumerOrProducer, logger, onShutdown)
    );
  });
}

async function handleExit(
  e: unknown,
  type: string,
  consumerOrProducer: Consumer | Producer,
  logger: Logger,
  onShutdown?: () => Promise<void>
) {
  try {
    if (e)
      logger.error(`Error ${type} intercepted. Error: ${JSON.stringify(e)}`);
    await consumerOrProducer.disconnect();
    logger.debug("Consumer/Producer disconnected successfully");
  } catch (err) {
    logger.error(
      `Error during disconnect on ${type}. Error: ${JSON.stringify(err)}`
    );
  } finally {
    await processExitAndDisconnect({ logger, onShutdown });
  }
}
