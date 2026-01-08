import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { initProducer, runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import {
  encodeOutboundPurposeTemplateEvent,
  PurposeTemplateEventV2 as PurposeTemplateOutboundEvent,
} from "@pagopa/interop-outbound-models";
import {
  CorrelationId,
  generateId,
  PurposeTemplateEvent,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import { toOutboundEventV2 } from "./converters/toOutboundEventV2.js";

const producer = await initProducer(
  config,
  config.purposeTemplateOutboundTopic
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, PurposeTemplateEvent);

  const loggerInstance = logger({
    serviceName: "purpose-outbound-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    streamVersion: msg.version,
    correlationId: msg.correlation_id
      ? unsafeBrandId<CorrelationId>(msg.correlation_id)
      : generateId<CorrelationId>(),
  });

  const outboundEvent: PurposeTemplateOutboundEvent | undefined = match(msg)
    .with({ event_version: 2 }, (msg) => toOutboundEventV2(msg))
    .exhaustive();

  if (outboundEvent) {
    await producer.send({
      messages: [
        {
          key: outboundEvent.stream_id,
          value: encodeOutboundPurposeTemplateEvent(outboundEvent),
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
  [config.purposeTemplateOutboundTopic],
  processMessage,
  "purpose-outbound-writer"
);
