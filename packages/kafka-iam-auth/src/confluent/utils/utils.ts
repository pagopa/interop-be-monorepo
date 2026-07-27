import { KafkaMessage } from "@confluentinc/kafka-javascript/types/kafkajs.js";
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

export function extractBasicMessageInfo(message: KafkaMessage): {
  offset: string;
  streamId?: string;
  eventType?: string;
  eventVersion?: number;
  streamVersion?: number;
  correlationId?: string;
} {
  try {
    if (!message.value) {
      return { offset: message.offset };
    }

    const rawMessage = JSON.parse(message.value.toString());
    const dataSource =
      rawMessage.value?.after || rawMessage.after || rawMessage;
    return {
      offset: message.offset,
      streamId: dataSource.stream_id || dataSource.streamId || dataSource.id,
      eventType: dataSource.type,
      eventVersion: dataSource.event_version,
      streamVersion: dataSource.version,
      correlationId: dataSource.correlation_id,
    };
  } catch {
    return { offset: message.offset };
  }
}
