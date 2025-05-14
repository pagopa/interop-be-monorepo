import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { getReadModelService } from "../test/utils.js";
import { config } from "./config/config.js";
import { selfcareClientUsersUpdaterProcessorBuilder } from "./services/selfcareClientUsersUpdaterProcessor.js";
import { authorizationProcessClientBuilder } from "./clients/authorizationProcessClient.js";

const readModelService = getReadModelService(config);

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
