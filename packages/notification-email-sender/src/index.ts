/* eslint-disable @typescript-eslint/no-empty-function */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  EmailManagerSES,
  ReadModelRepository,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initSesMailManager,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  CorrelationId,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { config } from "./config/config.js";
import { notificationEmailSenderServiceBuilder } from "./services/notificationEmailSenderService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const templateService = buildHTMLTemplateService();
const interopFeBaseUrl = config.interopFeBaseUrl;
const sesEmailManager: EmailManagerSES = initSesMailManager(config);
const sesEmailsenderData = {
  label: config.senderLabel,
  mail: config.senderMail,
};

const notificationEmailSenderService = notificationEmailSenderServiceBuilder(
  sesEmailManager,
  sesEmailsenderData,
  readModelService,
  templateService,
  interopFeBaseUrl
);

export async function processMessage({
  message,
}: EachMessagePayload): Promise<void> {
  const handleMessageToSkip = async (): Promise<void> => {};

  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerInstance = logger({
    serviceName: "notification-email-sender",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  loggerInstance.debug(decodedMessage);

  await match(decodedMessage)
    .with(
      { event_version: 2, type: "AgreementActivated" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await Promise.all([
            notificationEmailSenderService.sendActivationNotificationSimpleEmail(
              agreement,
              loggerInstance
            ),
          ]);
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMessage.type);
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementSubmitted" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await notificationEmailSenderService.sendSubmissionNotificationSimpleEmail(
            agreement,
            loggerInstance
          );
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMessage.type);
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementRejected" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await notificationEmailSenderService.sendRejectNotificationSimpleEmail(
            agreement,
            loggerInstance
          );
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMessage.type);
        }
      }
    )
    .with(
      {
        event_version: 2,
        type: P.union(
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementUnsuspendedByProducer",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementArchivedByUpgrade",
          "AgreementUpgraded",
          "AgreementSuspendedByProducer",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByPlatform",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform"
        ),
      },
      handleMessageToSkip
    )
    .with(
      {
        event_version: 1,
      },
      handleMessageToSkip
    )
    .exhaustive();
}

await runConsumer(config, [config.agreementTopic], processMessage);
