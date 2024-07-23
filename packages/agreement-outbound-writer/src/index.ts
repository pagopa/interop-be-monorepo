import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger } from "pagopa-interop-commons";
import { initProducer, runConsumer } from "kafka-iam-auth";
import { AgreementEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV1 } from "./consumerServiceV1.js";
import { handleMessageV2 } from "./consumerServiceV2.js";
import { config } from "./config/config.js";

const producer = await initProducer(config, "test");

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

  const outboundEvent = match(msg)
    .with({ event_version: 1 }, (msg) => handleMessageV1(msg))
    .with({ event_version: 2 }, (msg) => handleMessageV2(msg))
    .exhaustive();

  await producer.send({
    messages: [{ value: JSON.stringify(outboundEvent) }],
  });

  loggerInstance.info(
    `Partition number: ${partition}. Offset: ${message.offset}`
  );
}

await runConsumer(config, [config.agreementTopic], processMessage);
