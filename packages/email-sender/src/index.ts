import { runConsumer } from "kafka-iam-auth";
import {
  EmailManagerSES,
  initSesMailManager,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { emailSenderProcessorBuilder } from "./services/emailSenderProcessor.js";
import { config } from "./config/config.js";

const sesEmailsenderData = {
  label: config.senderLabel,
  mail: config.senderMail,
};

const correlationId: CorrelationId = generateId();

const loggerInstance = logger({
  serviceName: "email-sender",
  correlationId,
});

const sesEmailManager: EmailManagerSES = initSesMailManager(config, {
  logger: loggerInstance,
  skipTooManyRequestsError: false,
});

const processor = emailSenderProcessorBuilder(
  loggerInstance,
  sesEmailManager,
  sesEmailsenderData
);

await runConsumer(config, [config.emailTopic], processor.processMessage);
