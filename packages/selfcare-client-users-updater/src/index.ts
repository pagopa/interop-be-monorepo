import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  clientReadModelServiceBuilder,
  makeDrizzleConnection,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { selfcareClientUsersUpdaterProcessorBuilder } from "./services/selfcareClientUsersUpdaterProcessor.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { authorizationProcessClientBuilder } from "./clients/authorizationProcessClient.js";

const readModelDB = makeDrizzleConnection(config);
const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);
const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const readModelServiceSQL = readModelServiceBuilderSQL({
  clientReadModelServiceSQL,
});
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const authorizationProcessClient = authorizationProcessClientBuilder(
  config.authorizationProcessUrl
);

const processor = selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken,
  authorizationProcessClient,
  readModelService,
  config.interopProduct
);

await runConsumer(
  config,
  [config.selfcareUsersTopic],
  processor.processMessage
);
