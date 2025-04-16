import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { authorizationProcessClientBuilder } from "./clients/authorizationProcessClient.js";
import { selfcareClientUsersUpdaterProcessorBuilder } from "./services/selfcareClientUsersUpdaterProcessor.js";

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const authorizationProcessClient = authorizationProcessClientBuilder(
  config.authorizationProcessUrl
);

const processor = selfcareClientUsersUpdaterProcessorBuilder(
  refreshableToken,
  authorizationProcessClient,
  config.interopProductId,
  config.allowedOriginsUuid
);

await runConsumer(config, [config.selfcareTopic], processor.processMessage);
