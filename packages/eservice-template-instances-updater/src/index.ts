import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  initFileManager,
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { runConsumer } from "kafka-iam-auth";
import { EServiceTemplateEvent } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { handleMessageV2 } from "./eserviceTemplateInstancesUpdaterConsumerServiceV2.js";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./readModelService.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

await refreshableToken.init();
const fileManager = initFileManager(config);

async function processMessage({
  message,
  partition,
}: EachMessagePayload): Promise<void> {
  const decodedKafkaMessage = decodeKafkaMessage(
    message,
    EServiceTemplateEvent
  );

  await match(decodedKafkaMessage)
    .with({ event_version: 2 }, (msg) =>
      handleMessageV2({
        decodedKafkaMessage: msg,
        refreshableToken,
        partition,
        offset: message.offset,
        readModelService,
        fileManager,
      })
    )
    .exhaustive();
}

await runConsumer(config, [config.eserviceTemplateTopic], processMessage);
