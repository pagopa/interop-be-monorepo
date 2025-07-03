/* eslint-disable sonarjs/no-identical-functions */
import { runConsumer } from "kafka-iam-auth";
import { EachMessagePayload } from "kafkajs";
import { decodeKafkaMessage, logger, Logger } from "pagopa-interop-commons";
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
import { config } from "./config/config.js";

interface TopicHandlers {
  catalogTopic: string;
  agreementTopic: string;
  purposeTopic: string;
}

// const readModelDB = makeDrizzleConnection(config);
// const agreementReadModelServiceSQL =
//   agreementReadModelServiceBuilder(readModelDB);
// const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
// const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

// const oldReadModelService = readModelServiceBuilder(
//   ReadModelRepository.init(config)
// );
// const readModelServiceSQL = readModelServiceBuilderSQL({
//   agreementReadModelServiceSQL,
//   catalogReadModelServiceSQL,
//   tenantReadModelServiceSQL,
// });
// const readModelService =
//   config.featureFlagSQL &&
//   config.readModelSQLDbHost &&
//   config.readModelSQLDbPort
//     ? readModelServiceSQL
//     : oldReadModelService;

// const templateService = buildHTMLTemplateService();
// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleCatalogMessage(
  decodedMessage: EServiceEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      { type: "EServiceDescriptorPublished" },
      async ({ data: { eservice } }) => {
        if (eservice) {
          handleEServiceDescriptorPublished(eservice, logger);
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
          "EServiceSignalHubDisabled"
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

export async function handlePurposeMessage(
  decodedMessage: PurposeEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  match(decodedMessage)
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeWaitingForApproval",
          "PurposeVersionRejected",
          "PurposeVersionActivated",
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
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

export async function handleAgreementMessage(
  decodedMessage: AgreementEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  match(decodedMessage)
    .with(
      {
        type: P.union(
          "AgreementActivated",
          "AgreementSubmitted",
          "AgreementRejected",
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
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}

function processMessage(topicHandlers: TopicHandlers) {
  return async (messagePayload: EachMessagePayload): Promise<void> => {
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
      serviceName: "in-app-notification-dispatcher",
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

    await handleMessage(loggerInstance);
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
  "in-app-notification-dispatcher"
);
