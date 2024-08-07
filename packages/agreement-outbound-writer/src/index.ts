import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { initProducer, runConsumer } from "kafka-iam-auth";
import { match } from "ts-pattern";
import {
  encodeOutboundAgreementEvent,
  AgreementEvent as AgreementOutboundEvent,
} from "@pagopa/interop-outbound-models";
import { AgreementEvent } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { toOutboundEventV1 } from "./converters/toOutboundEventV1.js";
import { toOutboundEventV2 } from "./converters/toOutboundEventV2.js";

const producer = await initProducer(config, config.agreementOutboundTopic);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const msg = decodeKafkaMessage(message, AgreementEvent);

  const loggerInstance = logger({
    serviceName: "agreement-outbound-writer",
    eventType: msg.type,
    eventVersion: msg.event_version,
    streamId: msg.stream_id,
    correlationId: msg.correlation_id,
  });

  const outboundEvent: AgreementOutboundEvent = match(msg)
    .with({ event_version: 1 }, (msg) => toOutboundEventV1(msg))
    .with({ event_version: 2 }, (msg) => toOutboundEventV2(msg))
    .exhaustive();

  await producer.send({
    messages: [{ value: encodeOutboundAgreementEvent(outboundEvent) }],
  });

  loggerInstance.info(
    `Outbound event sent! Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.agreementTopic], processMessage);
