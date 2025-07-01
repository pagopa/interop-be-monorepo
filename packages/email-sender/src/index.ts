import { runConsumer } from "kafka-iam-auth";
import { EmailManagerSES, initSesMailManager } from "pagopa-interop-commons";
import { emailSenderProcessorBuilder } from "./services/emailSenderProcessor.js";
import { config } from "./config/config.js";

const sesEmailSenderData = {
  label: config.senderLabel,
  mail: config.senderMail,
};

const sesEmailManager: EmailManagerSES = initSesMailManager(config, {
  skipTooManyRequestsError: false,
});

const processor = emailSenderProcessorBuilder(
  sesEmailSenderData,
  sesEmailManager
);

await runConsumer(config, [config.emailTopic], processor.processMessage);
