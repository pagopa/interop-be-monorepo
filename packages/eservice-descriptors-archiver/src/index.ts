/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  agreementTopicConfig,
  decodeKafkaMessage,
  logger,
  runWithContext,
  kafkaConsumerConfig,
  jwtSeedConfig,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AgreementEvent, fromAgreementV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceDescriptorArchiverBuilder } from "./eserviceDescriptorsArchiver.js";

const jwtConfig = jwtSeedConfig();
const consumerConfig = kafkaConsumerConfig();
const { agreementTopic } = agreementTopicConfig();
const eserviceDescriptorArchiver = await eserviceDescriptorArchiverBuilder(
  jwtConfig
);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedMsg = decodeKafkaMessage(message, AgreementEvent);

  await runWithContext(
    {
      messageData: {
        eventType: decodedMsg.type,
        eventVersion: decodedMsg.event_version,
        streamId: decodedMsg.stream_id,
      },
      correlationId: decodedMsg.correlation_id,
    },
    async () =>
      match(decodedMsg)
        .with(
          {
            event_version: 2,
            type: "AgreementArchivedByUpgrade",
          },
          {
            event_version: 2,
            type: "AgreementArchived",
          },
          async ({ data: { agreement } }) => {
            if (agreement) {
              logger.info(
                `Processing ${decodedMsg.type} message - Partition number: ${partition} - Offset: ${message.offset}`
              );
              await eserviceDescriptorArchiver.archiveDescriptorsForArchivedAgreement(
                fromAgreementV2(agreement)
              );
            } else {
              logger.error(`Agreement not found in message ${decodedMsg.type}`);
            }
          }
        )
        .otherwise(() => undefined)
  );
}

await runConsumer(consumerConfig, [agreementTopic], processMessage);
