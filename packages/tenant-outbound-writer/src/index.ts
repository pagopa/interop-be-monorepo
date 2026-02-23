import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { initProducer, runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import {
  encodeOutboundTenantEvent,
  TenantEvent as TenantOutboundEvent,
} from "@pagopa/interop-outbound-models";
import {
  CorrelationId,
  generateId,
  TenantEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import { toOutboundEventV1 } from "./converters/toOutboundEventV1.js";
import { toOutboundEventV2 } from "./converters/toOutboundEventV2.js";

const producer = await initProducer(config, config.tenantOutboundTopic);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, TenantEvent);

  const loggerInstance = logger({
    serviceName: "tenant-outbound-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    streamVersion: msg.version,
    correlationId: msg.correlation_id
      ? unsafeBrandId<CorrelationId>(msg.correlation_id)
      : generateId<CorrelationId>(),
  });

  const outboundEvent: TenantOutboundEvent | undefined = match(msg)
    .with({ event_version: 1 }, (msg) => toOutboundEventV1(msg))
    .with({ event_version: 2 }, (msg) => toOutboundEventV2(msg))
    .exhaustive();

  if (outboundEvent) {
    await producer.send({
      messages: [
        {
          key: outboundEvent.stream_id,
          value: encodeOutboundTenantEvent(outboundEvent),
        },
      ],
    });
  }

  loggerInstance.info(
    `Outbound event sent! Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(
  config,
  [config.tenantTopic],
  processMessage,
  "tenant-outbound-writer"
);
