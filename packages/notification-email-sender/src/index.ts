/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import {
  EmailManagerSES,
  buildHTMLTemplateService,
  decodeKafkaMessage,
  initSesMailManager,
  logger,
  Logger,
  genericLogger,
} from "pagopa-interop-commons";
import {
  AgreementEventEnvelopeV2,
  AgreementEventV2,
  CorrelationId,
  EServiceEventEnvelopeV2,
  EServiceEventV2,
  generateId,
  genericInternalError,
  missingKafkaMessageDataError,
  PurposeEventEnvelopeV2,
  PurposeEventV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { createClient } from "redis";
import { config } from "./config/config.js";
import {
  NotificationEmailSenderService,
  notificationEmailSenderServiceBuilder,
} from "./services/notificationEmailSenderService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

interface TopicHandlers {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
}

const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

const templateService = buildHTMLTemplateService();
const interopFeBaseUrl = config.interopFeBaseUrl;

const sesEmailsenderData = {
  label: config.senderLabel,
  mail: config.senderMail,
};

const redisClient = await createClient({
  socket: {
    host: config.redisNotificationEmailSenderHost,
    port: config.redisNotificationEmailSenderPort,
  },
})
  .on("error", (err) => genericLogger.warn(`Redis Client Error: ${err}`))
  .connect();

const buildNotificationEmailSenderService =
  (): NotificationEmailSenderService => {
    const sesEmailManager: EmailManagerSES = initSesMailManager(config, {
      skipTooManyRequestsError: true,
    });

    return notificationEmailSenderServiceBuilder(
      sesEmailManager,
      sesEmailsenderData,
      readModelServiceSQL,
      templateService,
      interopFeBaseUrl
    );
  };

export async function handleCatalogMessage(
  decodedMessage: EServiceEventEnvelopeV2,
  notificationEmailSenderService: NotificationEmailSenderService,
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
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
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
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
          "EServiceSignalHubEnabled",
          "EServiceSignalHubDisabled",
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate"
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
  notificationEmailSenderService: NotificationEmailSenderService,
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
          "PurposeVersionArchivedByRevokedDelegation",
          "RiskAnalysisDocumentGenerated"
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
  notificationEmailSenderService: NotificationEmailSenderService,
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
          "AgreementArchivedByRevokedDelegation",
          "AgreementContractGenerated"
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
    const redisKey = `notification-email-sender-${messagePayload.topic}-${messagePayload.partition}-${messagePayload.message.offset}`;
    const isAlreadyProcessed = await redisClient.get(redisKey);
    if (isAlreadyProcessed) {
      return;
    }
    await redisClient.set(redisKey, "true", {
      EX: config.redisNotificationEmailSenderTtlSeconds,
    });

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

        const handleMessage = handleAgreementMessage.bind(null, decodedMessage);

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
      streamVersion: decodedMessage.version,
      correlationId: decodedMessage.correlation_id
        ? unsafeBrandId<CorrelationId>(decodedMessage.correlation_id)
        : generateId<CorrelationId>(),
    });
    loggerInstance.info(
      `Processing ${decodedMessage.type} message - Partition number: ${messagePayload.partition} - Offset: ${messagePayload.message.offset}`
    );

    const notificationEmailSenderService =
      buildNotificationEmailSenderService();

    try {
      await handleMessage(notificationEmailSenderService, loggerInstance);
    } catch (error) {
      loggerInstance.error(
        `Error processing message: ${error}. Message will be committed to prevent reprocessing.`
      );
      // Intentionally not re-throwing to ensure message gets committed
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
  }),
  "notification-email-sender"
);
