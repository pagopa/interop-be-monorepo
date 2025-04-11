/* eslint-disable @typescript-eslint/no-empty-function */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  EmailManagerPEC,
  ReadModelRepository,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initPecEmailManager,
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
import { certifiedEmailSenderServiceBuilder } from "./services/certifiedEmailSenderService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const templateService = buildHTMLTemplateService();

const pecEmailManager: EmailManagerPEC = initPecEmailManager(config);
const pecEmailSenderData = {
  label: config.pecSenderLabel,
  mail: config.pecSenderMail,
};

const certifiedEmailSenderService = certifiedEmailSenderServiceBuilder(
  pecEmailManager,
  pecEmailSenderData,
  readModelService,
  templateService
);

export async function processMessage({
  message,
}: EachMessagePayload): Promise<void> {
  const handleMessageToSkip = async (): Promise<void> => {};

  const decodedMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerInstance = logger({
    serviceName: "certified-email-sender",
    eventType: decodedMessage.type,
    eventVersion: decodedMessage.event_version,
    streamId: decodedMessage.stream_id,
    streamVersion: decodedMessage.version,
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
          await certifiedEmailSenderService.sendAgreementActivatedCertifiedEmail(
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
          "AgreementRejected",
          "AgreementSubmitted",
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
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementArchivedByRevokedDelegation",
          "AgreementDeletedByRevokedDelegation"
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
