import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  decodeKafkaMessage,
  initFileManager,
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { EServiceTemplateEvent } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { match } from "ts-pattern";

import { config } from "./config/config.js";
import { handleMessageV2 } from "./eserviceTemplateInstancesUpdaterConsumerServiceV2.js";
import { readModelServiceBuilderSQL } from "./readModelServiceSQL.js";

const refreshableToken = new RefreshableInteropToken(
  new InteropTokenGenerator(config)
);

const readModelDB = makeDrizzleConnection(config);

const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

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
        readModelService: readModelServiceSQL,
        fileManager,
      })
    )
    .exhaustive();
}

await runConsumer(
  config,
  [config.eserviceTemplateTopic],
  processMessage,
  config.featureFlagConfluentKafka,
  "eservice-template-instances-updater"
);
