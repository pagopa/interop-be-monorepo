import { genericLogger } from "pagopa-interop-commons";

/**
 * Minimal message shape compatible with both kafkajs and Confluent KafkaJS.
 * Only the properties actually used by common utilities are required.
 */
export type BasicKafkaMessage = {
  value: Buffer | null;
  offset: string;
};

/**
 * Minimal message payload shape compatible with both kafkajs and Confluent KafkaJS.
 * Only the properties actually used by common utilities are required.
 */
export type BasicMessagePayload = {
  topic: string;
  partition: number;
  message: { offset: string };
};

export const errorTypes = ["unhandledRejection", "uncaughtException"];
export const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

export const processExit = (exitStatusCode: number = 1): void => {
  genericLogger.debug(`Process exit with code ${exitStatusCode}`);
  process.exit(exitStatusCode);
};

export const errorEventsListener = (consumerOrProducer: {
  disconnect: () => Promise<void>;
}): void => {
  errorTypes.forEach((type) => {
    process.on(type, async (e) => {
      try {
        genericLogger.error(`Error ${type} intercepted; Error detail: ${e}`);
        await consumerOrProducer.disconnect().finally(() => {
          genericLogger.debug("Disconnected successfully");
        });
        processExit();
      } catch (e) {
        genericLogger.error(
          `Unexpected error on disconnection with event type ${type}; Error detail: ${e}`
        );
        processExit();
      }
    });
  });

  signalTraps.forEach((type) => {
    process.once(type, async () => {
      try {
        await consumerOrProducer.disconnect().finally(() => {
          genericLogger.debug("Disconnected successfully");
          processExit();
        });
      } finally {
        process.kill(process.pid, type);
      }
    });
  });
};

export const kafkaCommitMessageOffsets = async (
  consumer: { commitOffsets: (offsets: Array<{ topic: string; partition: number; offset: string }>) => Promise<void> },
  payload: BasicMessagePayload
): Promise<void> => {
  const { topic, partition, message } = payload;
  await consumer.commitOffsets([
    { topic, partition, offset: (Number(message.offset) + 1).toString() },
  ]);

  genericLogger.debug(
    `Topic message offset ${Number(message.offset) + 1} committed`
  );
};

export function extractBasicMessageInfo(message: BasicKafkaMessage): {
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
