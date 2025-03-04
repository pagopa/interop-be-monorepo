/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  EmailManagerSES,
  ReadModelRepository,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initSesMailManager,
  logger,
  Logger,
} from "pagopa-interop-commons";
import {
  AgreementEventEnvelopeV2,
  AgreementEventV2,
  CorrelationId,
  EServiceEventEnvelopeV2,
  EServiceEventV2,
  generateId,
  genericInternalError,
  kafkaMessageProcessError,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { config } from "./config/config.js";
import { notificationEmailSenderServiceBuilder } from "./services/notificationEmailSenderService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";

interface TopicHandlers {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
}

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

export async function handleCatalogMessage(
  decodedMessage: EServiceEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      { type: "EServiceDescriptorPublished" },
      async ({ data: { eservice } }) => {
        if (eservice) {
          await notificationEmailSenderService.sendEserviceDescriptorPublishedEmail(
            eservice,
            logger
          );
        } else {
          throw missingKafkaMessageDataError("eservice", decodedMessage.type);
        }
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorActivated",
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorSuspended",
          "EServiceDescriptorArchived",
          "EServiceDescriptorQuotasUpdated",
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "DraftEServiceUpdated",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "EServiceRiskAnalysisDeleted",
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptionUpdated",
          "EServiceNameUpdated",
          "EServiceDescriptorSubmittedByDelegate",
          "EServiceDescriptorRejectedByDelegator",
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      () => {
        logger.info(
          `No need to send a notification email for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

export async function handlePurposeMessage(
  decodedMessage: PurposeEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      { type: "NewPurposeVersionWaitingForApproval" },
      async ({ data: { purpose } }) => {
        if (purpose) {
          await notificationEmailSenderService.sendNewPurposeVersionWaitingForApprovalEmail(
            purpose,
            logger
          );
        } else {
          throw missingKafkaMessageDataError("purpose", decodedMessage.type);
        }
      }
    )
    .with(
      { type: "PurposeWaitingForApproval" },
      async ({ data: { purpose } }) => {
        if (purpose) {
          await notificationEmailSenderService.sendPurposeWaitingForApprovalEmail(
            purpose,
            logger
          );
        } else {
          throw missingKafkaMessageDataError("purpose", decodedMessage.type);
        }
      }
    )
    .with({ type: "PurposeVersionRejected" }, async ({ data: { purpose } }) => {
      if (purpose) {
        await notificationEmailSenderService.sendPurposeVersionRejectedEmail(
          purpose,
          logger
        );
      } else {
        throw missingKafkaMessageDataError("purpose", decodedMessage.type);
      }
    })
    .with(
      { type: "PurposeVersionActivated" },
      async ({ data: { purpose } }) => {
        if (purpose) {
          await notificationEmailSenderService.sendPurposeVersionActivatedEmail(
            purpose,
            logger
          );
        } else {
          throw missingKafkaMessageDataError("purpose", decodedMessage.type);
        }
      }
    )
    .with(
      {
        type: P.union(
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeActivated",
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(
          `No need to send a notification email for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

export async function handleAgreementMessage(
  decodedMessage: AgreementEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "AgreementActivated" }, async ({ data: { agreement } }) => {
      if (agreement) {
        await notificationEmailSenderService.sendAgreementActivatedEmail(
          agreement,
          logger
        );
      } else {
        throw missingKafkaMessageDataError("agreement", decodedMessage.type);
      }
    })
    .with({ type: "AgreementSubmitted" }, async ({ data: { agreement } }) => {
      if (agreement) {
        await notificationEmailSenderService.sendAgreementSubmittedEmail(
          agreement,
          logger
        );
      } else {
        throw missingKafkaMessageDataError("agreement", decodedMessage.type);
      }
    })
    .with({ type: "AgreementRejected" }, async ({ data: { agreement } }) => {
      if (agreement) {
        await notificationEmailSenderService.sendAgreementRejectedEmail(
          agreement,
          logger
        );
      } else {
        throw missingKafkaMessageDataError("agreement", decodedMessage.type);
      }
    })
    .with(
      {
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
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(
          `No need to send a notification email for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

function processMessage(topicHandlers: TopicHandlers) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
    try {
      const { catalogTopic, agreementTopic, purposeTopic } = topicHandlers;

      const { decodedMessage, handleMessage } = match(messagePayload.topic)
        .with(catalogTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            EServiceEventV2
          );

          const handleMessage = handleCatalogMessage.bind(null, decodedMessage);

          return { decodedMessage, handleMessage };
        })
        .with(agreementTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            AgreementEventV2
          );

          const handleMessage = handleAgreementMessage.bind(
            null,
            decodedMessage
          );

          return { decodedMessage, handleMessage };
        })
        .with(purposeTopic, () => {
          const decodedMessage = decodeKafkaMessage(
            messagePayload.message,
            PurposeEventV2
          );

          const handleMessage = handlePurposeMessage.bind(null, decodedMessage);

          return { decodedMessage, handleMessage };
        })
        .otherwise(() => {
          throw genericInternalError(`Unknown topic: ${messagePayload.topic}`);
        });

      const loggerInstance = logger({
        serviceName: "notification-email-sender",
        eventType: decodedMessage.type,
        eventVersion: decodedMessage.event_version,
        streamId: decodedMessage.stream_id,
        correlationId: decodedMessage.correlation_id
          ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
          : generateId<CorrelationId>(),
      });
      loggerInstance.info(
        `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
      );

      await handleMessage(loggerInstance);
    } catch (e) {
      throw kafkaMessageProcessError(
        messagePayload.topic,
        messagePayload.partition,
        messagePayload.message.offset,
        e
      );
    }
  };
}

await runConsumer(
  config,
  [config.catalogTopic, config.agreementTopic, config.purposeTopic],
  processMessage({
    catalogTopic: config.catalogTopic,
    agreementTopic: config.agreementTopic,
    purposeTopic: config.purposeTopic,
  })
);
