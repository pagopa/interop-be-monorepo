import { KafkaBatchConsumerConfig } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";

describe("KafkaBatchConsumerConfig", () => {
  it("allows a single partition to return the configured batch size", () => {
    const batchConsumerConfig = KafkaBatchConsumerConfig.parse({
      AVERAGE_KAFKA_MESSAGE_SIZE_IN_BYTES: 1_000,
      MESSAGES_TO_READ_PER_BATCH: 1_000,
      MAX_WAIT_KAFKA_BATCH_MILLIS: 60_000,
    });

    expect(batchConsumerConfig).toMatchObject({
      minBytes: 1_000_000,
      maxBytes: 1_250_000,
      maxBytesPerPartition: 1_250_000,
    });
  });
});
