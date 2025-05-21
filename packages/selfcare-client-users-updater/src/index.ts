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
import {
  config,
  SelfcareClientUsersUpdaterConsumerConfig,
} from "./config/config.js";
import { selfcareClientUsersUpdaterProcessorBuilder } from "./services/selfcareClientUsersUpdaterProcessor.js";
import { authorizationProcessClientBuilder } from "./clients/authorizationProcessClient.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getReadModelService(
  config: SelfcareClientUsersUpdaterConsumerConfig
) {
  const readModelDB = makeDrizzleConnection(config);
  const clientReadModelServiceSQL = clientReadModelServiceBuilder(readModelDB);
  const oldReadModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );
  const readModelServiceSQL = readModelServiceBuilderSQL({
    clientReadModelServiceSQL,
  });
  return config.featureFlagSQL ? readModelServiceSQL : oldReadModelService;
}

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const authorizationProcessClient = authorizationProcessClientBuilder(
  config.authorizationProcessUrl
);

const processor = selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken,
  authorizationProcessClient,
  getReadModelService(config),
  config.interopProduct
);

await runConsumer(
  config,
  [config.selfcareUsersTopic],
  processor.processMessage
);
