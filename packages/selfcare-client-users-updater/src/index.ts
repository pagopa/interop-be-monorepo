import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  clientReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";

import { authorizationProcessClientBuilder } from "./clients/authorizationProcessClient.js";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { selfcareClientUsersUpdaterProcessorBuilder } from "./services/selfcareClientUsersUpdaterProcessor.js";

const readModelDB = makeDrizzleConnection(config);
const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  clientReadModelServiceSQL,
});

const authorizationProcessClient = authorizationProcessClientBuilder(
  config.authorizationProcessUrl
);

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const processor = selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken,
  authorizationProcessClient,
  readModelServiceSQL,
  config.interopProduct
);

await runConsumer(
  config,
  [config.selfcareTopic],
  processor.processMessage,
  config.featureFlagConfluentKafka
);
