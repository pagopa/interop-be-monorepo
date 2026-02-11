import { runConsumer } from "kafka-iam-auth";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { messageProcessorBuilder } from "./services/messageProcessor.js";
import { config } from "./config/config.js";

// Initialize database connections
const readModelDB = makeDrizzleConnection(config);

const notificationConfigProcessClient =
  notificationConfigApi.createNotificationConfigClient(
    config.notificationConfigProcessUrl
  );

const readModelServiceSQL = readModelServiceBuilderSQL({ readModelDB });
const interopTokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(interopTokenGenerator);

const messageProcessor = messageProcessorBuilder(
  readModelServiceSQL,
  notificationConfigProcessClient,
  refreshableToken
);

await runConsumer(
  config,
  [config.selfcareTopic],
  messageProcessor.processMessage
);
