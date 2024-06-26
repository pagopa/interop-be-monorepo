/* eslint-disable @typescript-eslint/no-empty-function */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  agreementTopicConfig,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initEmailManager,
  kafkaConsumerConfig,
  logger,
  readModelWriterConfig,
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
import {
  pecEmailManagerConfig,
  emailManagerConfig,
  agreementEmailSenderConfig,
} from "./utilities/config.js";

const config = agreementEmailSenderConfig();
const kafkaConfig = kafkaConsumerConfig();
const readModelConfig = readModelWriterConfig();
const topicsConfig = agreementTopicConfig();
const pecEmailConfig = pecEmailManagerConfig();
const pecEmailManager = initEmailManager(pecEmailConfig);
const emailConfig = emailManagerConfig();
const emailManager = initEmailManager(emailConfig);
const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(readModelConfig)
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
            emailManager,
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

await runConsumer(kafkaConfig, [topicsConfig.agreementTopic], processMessage);
