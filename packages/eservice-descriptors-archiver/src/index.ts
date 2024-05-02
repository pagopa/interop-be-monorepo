/* eslint-disable functional/immutable-data */
import { EachMessagePayload } from "kafkajs";
import {
  readModelWriterConfig,
  agreementTopicConfig,
  decodeKafkaMessage,
  logger,
  runWithContext,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { AgreementEvent, fromAgreementV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { archiveEserviceDescriptors } from "./eserviceDescriptorsArchiver.js";

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
              await archiveEserviceDescriptors(fromAgreementV2(agreement));
            } else {
              logger.error(`Agreement not found in message ${decodedMsg.type}`);
            }
          }
        )
        .otherwise(() => undefined)
  );
}

try {
  const config = readModelWriterConfig();
  const { agreementTopic } = agreementTopicConfig();
  await runConsumer(config, [agreementTopic], processMessage);
} catch (e) {
  logger.error(`An error occurred during initialization:\n${e}`);
}
