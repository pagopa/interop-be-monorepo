import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { initProducer, runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import {
  encodeOutboundEServiceEvent,
  EServiceEvent as EServiceOutboundEvent,
} from "@pagopa/interop-outbound-models";
import { EServiceEvent } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { toOutboundEventV1 } from "./converters/toOutboundEventV1.js";
import { toOutboundEventV2 } from "./converters/toOutboundEventV2.js";

const producer = await initProducer(
  config.producerConfig,
  config.catalogOutboundTopic
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, EServiceEvent);

  const loggerInstance = logger({
    serviceName: "catalog-outbound-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    correlationId: msg.correlation_id,
  });

  const outboundEvent: EServiceOutboundEvent | undefined = match(msg)
    .with({ event_version: 1 }, (msg) => toOutboundEventV1(msg))
    .with({ event_version: 2 }, (msg) => toOutboundEventV2(msg))
    .exhaustive();

  if (outboundEvent) {
    await producer.send({
      messages: [{ value: encodeOutboundEServiceEvent(outboundEvent) }],
    });
  }

  loggerInstance.info(
    `Outbound event sent! Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config.consumerConfig, [config.catalogTopic], processMessage);
