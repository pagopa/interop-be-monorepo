import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { PurposeEventV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./clientPurposeUpdaterConsumerServiceV2.js";
import { config } from "./config/config.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);
await refreshableToken.init();

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedKafkaMessage = decodeKafkaMessage(message, PurposeEventV2);

  await match(decodedKafkaMessage)
    .with({ event_version: 2 }, () =>
      handleMessageV2({
        decodedKafkaMessage,
        refreshableToken,
        partition,
        offset: message.offset,
      })
    )
    .exhaustive();
}

await runConsumer(config, [config.authorizationTopic], processMessage);
