import { describe, it, expect } from "vitest";
import { EachMessagePayload } from "kafkajs";
import { isV1KafkaMessage, decodeKafkaMessage } from "pagopa-interop-commons";
import { AgreementEventV2 } from "pagopa-interop-models";

function createKafkaMessagePayload(
  topic: string,
  eventType: string,
  eventVersion: number
): EachMessagePayload {
  return {
    topic,
    partition: 0,
    message: {
      key: Buffer.from("test-key"),
      value: Buffer.from(
        JSON.stringify({
          op: "c",
          after: {
            sequence_num: 1,
            stream_id: "123e4567-e89b-12d3-a456-426614174000",
            version: 1,
            correlation_id: null,
            log_date: new Date().toISOString(),
            event_version: eventVersion,
            type: eventType,
            data: "",
          },
        })
      ),
      timestamp: "0",
      attributes: 0,
      offset: "0",
      size: 100,
      headers: undefined,
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    heartbeat: async (): Promise<void> => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    pause: (): (() => void) => () => {},
  };
}

describe("V1 Kafka message handling", () => {
  it.each([
    { topic: "catalog-topic", eventType: "EServiceAdded" },
    { topic: "agreement-topic", eventType: "AgreementAdded" },
    { topic: "purpose-topic", eventType: "PurposeCreated" },
    { topic: "delegation-topic", eventType: "DelegationCreated" },
    { topic: "authorization-topic", eventType: "KeysAdded" },
    { topic: "tenant-topic", eventType: "TenantCreated" },
  ])("should detect V1 $eventType event on $topic", ({ topic, eventType }) => {
    const payload = createKafkaMessagePayload(topic, eventType, 1);
    expect(isV1KafkaMessage(payload.message)).toBe(true);
  });

  it("should not detect V2 messages as V1", () => {
    const payload = createKafkaMessagePayload(
      "agreement-topic",
      "AgreementActivated",
      2
    );
    expect(isV1KafkaMessage(payload.message)).toBe(false);
  });

  it("should fail to decode a V1 message with a V2 schema", () => {
    const payload = createKafkaMessagePayload(
      "agreement-topic",
      "AgreementAdded",
      1
    );
    expect(() =>
      decodeKafkaMessage(payload.message, AgreementEventV2)
    ).toThrow();
  });
});
