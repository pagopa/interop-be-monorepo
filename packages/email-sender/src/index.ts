import { runConsumer } from "kafka-iam-auth";
import {
  buildHTMLTemplateService,
  EmailManagerSES,
  initSesMailManager,
} from "pagopa-interop-commons";
import { selfcareV2InstitutionClientBuilder } from "pagopa-interop-api-clients";
import {
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { emailSenderProcessorBuilder } from "./services/emailSenderProcessor.js";
import { config } from "./config/config.js";

const sesEmailSenderData = {
  label: config.senderLabel,
  mail: config.senderMail,
};

const sesEmailManager: EmailManagerSES = initSesMailManager(config, {
  skipTooManyRequestsError: false,
});

const selfcareV2InstitutionClient = selfcareV2InstitutionClientBuilder(config);
const readModelDB = makeDrizzleConnection(config);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const templateService = buildHTMLTemplateService();

const processor = emailSenderProcessorBuilder(
  sesEmailSenderData,
  sesEmailManager,
  selfcareV2InstitutionClient,
  tenantReadModelServiceSQL,
  templateService
);

await runConsumer(config, [config.emailSenderTopic], processor.processMessage);
