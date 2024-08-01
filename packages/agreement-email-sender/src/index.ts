/* eslint-disable @typescript-eslint/no-empty-function */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initPecEmailManager,
  initSesMailManager,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { readModelServiceBuilder } from "./services/readModelService.js";
import {
  sendAgreementActivationEmail,
  senderAgreementSubmissionEmail,
} from "./services/agreementEmailSenderService.js";

import { config } from "./config/config.js";

const sesEmailManager = initSesMailManager({ awsRegion: config.awsRegion });
const pecEmailManager = initPecEmailManager({
  smtpAddress: config.smtpAddress,
  smtpPort: config.smtpPort,
  smtpSecure: config.smtpSecure,
  smtpUsername: config.smtpUsername,
  smtpPassword: config.smtpPassword,
});

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const templateService = buildHTMLTemplateService();

export async function processMessage({
  message,
}: EachMessagePayload): Promise<void> {
  const handleMessageToSkip = async (): Promise<void> => {};

  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerInstance = logger({
    serviceName: "agreement-email-sender",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    correlationId: decodedMessage.correlation_id,
  });
  loggerInstance.debug(decodedMessage);

  await match(decodedMessage)
    .with(
      { event_version: 2, type: "AgreementActivated" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await sendAgreementActivationEmail({
            agreementV2: agreement,
            readModelService,
            emailManager: pecEmailManager,
            sender: {
              label: config.pecSenderLabel,
              mail: config.pecSenderMail,
            },
            templateService,
            logger: loggerInstance,
          });
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMessage.type);
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementSubmitted" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await senderAgreementSubmissionEmail({
            agreementV2: agreement,
            readModelService,
            emailManager: sesEmailManager,
            feBaseUrl: config.interopFeBaseUrl,
            sender: { label: config.senderLabel, mail: config.senderMail },
            templateService,
            logger: loggerInstance,
          });
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
          "AgreementRejected",
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
