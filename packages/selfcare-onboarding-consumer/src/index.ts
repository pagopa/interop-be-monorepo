import { runConsumer } from "kafka-iam-auth";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { logLevel } from "kafkajs";
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

// remember to pass starting offset earliest and also disable IAM auth
await runConsumer(
  {
    kafkaBrokers: config.selfcareBrokerUrls,
    kafkaDisableAwsIamAuth: true,
    kafkaBrokerConnectionString: config.brokerConnectionString,
    kafkaClientId: config.kafkaClientId,
    kafkaGroupId: config.kafkaGroupId,
    resetConsumerOffsets: config.resetConsumerOffsets,
    kafkaLogLevel: logLevel.INFO,
    topicStartingOffset: "earliest",
  },
  [config.topicName],
  processor.processMessage
);
