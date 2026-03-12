import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { tenantProcessClientBuilder } from "./clients/tenantProcessClient.js";
import { selfcareOnboardingProcessorBuilder } from "./services/selfcareOnboardingProcessor.js";

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
await refreshableToken.init();

const tenantProcessClient = tenantProcessClientBuilder(config.tenantProcessUrl);

const processor = selfcareOnboardingProcessorBuilder(
  refreshableToken,
  tenantProcessClient,
  config.interopProduct,
  config.allowedOrigins
);

await runConsumer(
  config,
  [config.selfcareTopic],
  processor.processMessage,
  "selfcare-onboarding-consumer"
);
