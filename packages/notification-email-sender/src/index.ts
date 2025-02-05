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
  EServiceEvent,
  generateId,
  missingKafkaMessageDataError,
  PurposeEvent,
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

  const decodedAgreementMessage = decodeKafkaMessage(message, AgreementEvent);
  const loggerAgreementInstance = logger({
    serviceName: "notification-email-sender",
    eventType: decodedAgreementMessage.type,
    eventVersion: decodedAgreementMessage.event_version,
    streamId: decodedAgreementMessage.stream_id,
    correlationId: decodedAgreementMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedAgreementMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  loggerAgreementInstance.debug(decodedAgreementMessage);

  await match(decodedAgreementMessage)
    .with(
      { event_version: 2, type: "AgreementActivated" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await Promise.all([
            notificationEmailSenderService.sendActivationNotificationSimpleEmail(
              agreement,
              loggerAgreementInstance
            ),
          ]);
        } else {
          throw missingKafkaMessageDataError(
            "agreement",
            decodedAgreementMessage.type
          );
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementSubmitted" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await notificationEmailSenderService.sendSubmissionNotificationSimpleEmail(
            agreement,
            loggerAgreementInstance
          );
        } else {
          throw missingKafkaMessageDataError(
            "agreement",
            decodedAgreementMessage.type
          );
        }
      }
    )
    .with(
      { event_version: 2, type: "AgreementRejected" },
      async ({ data: { agreement } }) => {
        if (agreement) {
          await notificationEmailSenderService.sendRejectNotificationSimpleEmail(
            agreement,
            loggerAgreementInstance
          );
        } else {
          throw missingKafkaMessageDataError(
            "agreement",
            decodedAgreementMessage.type
          );
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

  const decodedPurposeMessage = decodeKafkaMessage(message, PurposeEvent);
  const loggerPurposeInstance = logger({
    serviceName: "notification-email-sender",
    eventType: decodedPurposeMessage.type,
    eventVersion: decodedPurposeMessage.event_version,
    streamId: decodedPurposeMessage.stream_id,
    correlationId: decodedPurposeMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedPurposeMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  loggerPurposeInstance.debug(decodedPurposeMessage);

  await match(decodedPurposeMessage)
    .with(
      {
        event_version: 2,
        type: P.union(
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "NewPurposeVersionActivated",
          "NewPurposeVersionWaitingForApproval",
          "PurposeActivated",
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionRejected",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeWaitingForApproval",
          "WaitingForApprovalPurposeVersionDeleted",
          "PurposeVersionActivated",
          "PurposeCloned"
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

  const decodedEServiceMessage = decodeKafkaMessage(message, EServiceEvent);
  const loggerEServiceInstance = logger({
    serviceName: "notification-email-sender",
    eventType: decodedEServiceMessage.type,
    eventVersion: decodedEServiceMessage.event_version,
    streamId: decodedEServiceMessage.stream_id,
    correlationId: decodedEServiceMessage.correlation_id
      ? unsafeBrandId<CorrelationId>(decodedEServiceMessage.correlation_id)
      : generateId<CorrelationId>(),
  });
  loggerEServiceInstance.debug(decodedEServiceMessage);

  await match(decodedEServiceMessage)
    .with(
      {
        event_version: 2,
        type: P.union(
          "EServiceAdded",
          "DraftEServiceUpdated",
          "EServiceCloned",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorActivated",
          "EServiceDescriptorArchived",
          "EServiceDescriptorPublished",
          "EServiceDescriptorSuspended",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceDescriptorDocumentDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "EServiceRiskAnalysisDeleted",
          "EServiceDescriptionUpdated",
          "EServiceDescriptorSubmittedByDelegate",
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorRejectedByDelegator",
          "EServiceDescriptorAttributesUpdated",
          "EServiceNameUpdated",
          "EServiceDeleted"
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

await runConsumer(
  config,
  [config.purposeTopic, config.agreementTopic, config.catalogTopic],
  processMessage
);
