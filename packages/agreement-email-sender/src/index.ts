/* eslint-disable @typescript-eslint/no-empty-function */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  ReadModelRepository,
  agreementTopicConfig,
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
  sendAgreementSubmissionMail,
} from "./services/agreementEmailSenderService.js";
import {
  pecEmailManagerConfig,
  emailManagerConfig,
} from "./utilities/config.js";

const config = kafkaConsumerConfig();
const readModelConfig = readModelWriterConfig();
const topicsConfig = agreementTopicConfig();
const pecEmailConfig = pecEmailManagerConfig();
const pecEmailManager = initEmailManager(pecEmailConfig);
const emailConfig = emailManagerConfig();
const emailManager = initEmailManager(emailConfig);
const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(readModelConfig)
);

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
          await sendAgreementActivationEmail(
            agreement,
            readModelService,
            pecEmailManager,
            loggerInstance
          );
        } else {
          throw missingKafkaMessageDataError("agreement", decodedMessage.type);
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementSubmitted" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await sendAgreementSubmissionMail(
            agreement,
            readModelService,
            emailManager,
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

await runConsumer(config, [topicsConfig.agreementTopic], processMessage);
