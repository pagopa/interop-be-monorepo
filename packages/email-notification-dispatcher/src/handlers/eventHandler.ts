import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  AgreementEventEnvelopeV2,
  AttributeEventEnvelope,
  AuthorizationEventEnvelopeV2,
  CorrelationId,
  DelegationEventEnvelopeV2,
  EmailNotificationMessagePayload,
  EServiceEventEnvelopeV2,
  generateId,
  PurposeEventEnvelopeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { config } from "../config/config.js";
import { handleEserviceDescriptorPublished } from "./handleEServiceDescriptorPublished.js";

const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleEvent(
  decodedMessage:
    | EServiceEventEnvelopeV2
    | AgreementEventEnvelopeV2
    | PurposeEventEnvelopeV2
    | DelegationEventEnvelopeV2
    | AuthorizationEventEnvelopeV2
    | AttributeEventEnvelope,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
  return match(decodedMessage)
    .with(
      { type: "EServiceDescriptorPublished" },
      async ({ correlation_id, data: { eservice } }) =>
        await handleEserviceDescriptorPublished({
          eserviceV2Msg: eservice,
          interopFeBaseUrl,
          logger,
          readModelService,
          correlationId: correlation_id
            ? unsafeBrandId<CorrelationId>(correlation_id)
            : generateId<CorrelationId>(),
          templateService,
        })
    )
    .otherwise(() => {
      logger.info(
        `No need to send an in-app notification for ${decodedMessage.type} message`
      );
      return [];
    });
}

// export async function handleCatalogMessage(
//   decodedMessage: EServiceEventEnvelopeV2,
//   notificationEmailSenderService: NotificationEmailSenderService,
//   logger: Logger
// ): Promise<void> {
//   await match(decodedMessage)
//     .with(
//       { type: "EServiceDescriptorPublished" },
//       async ({ data: { eservice } }) => {
//         if (eservice) {
//           await notificationEmailSenderService.sendEserviceDescriptorPublishedEmail(
//             eservice,
//             logger
//           );
//         } else {
//           throw missingKafkaMessageDataError("eservice", decodedMessage.type);
//         }
//       }
//     )
//     .with(
//       {
//         type: P.union(
//           "EServiceDescriptorActivated",
//           "EServiceDescriptorApprovedByDelegator",
//           "EServiceDescriptorSuspended",
//           "EServiceDescriptorArchived",
//           "EServiceDescriptorQuotasUpdated",
//           "EServiceDescriptorAgreementApprovalPolicyUpdated",
//           "EServiceAdded",
//           "EServiceCloned",
//           "EServiceDeleted",
//           "DraftEServiceUpdated",
//           "EServiceDescriptorAdded",
//           "EServiceDraftDescriptorDeleted",
//           "EServiceDraftDescriptorUpdated",
//           "EServiceDescriptorDocumentAdded",
//           "EServiceDescriptorDocumentUpdated",
//           "EServiceDescriptorDocumentDeleted",
//           "EServiceDescriptorInterfaceAdded",
//           "EServiceDescriptorInterfaceUpdated",
//           "EServiceDescriptorInterfaceDeleted",
//           "EServiceRiskAnalysisAdded",
//           "EServiceRiskAnalysisUpdated",
//           "EServiceRiskAnalysisDeleted",
//           "EServiceDescriptorAttributesUpdated",
//           "EServiceDescriptionUpdated",
//           "EServiceNameUpdated",
//           "EServiceDescriptorSubmittedByDelegate",
//           "EServiceDescriptorRejectedByDelegator",
//           "EServiceIsConsumerDelegableEnabled",
//           "EServiceIsConsumerDelegableDisabled",
//           "EServiceIsClientAccessDelegableEnabled",
//           "EServiceIsClientAccessDelegableDisabled",
//           "EServiceIsClientAccessDelegableDisabled",
//           "EServiceNameUpdatedByTemplateUpdate",
//           "EServiceDescriptionUpdatedByTemplateUpdate",
//           "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
//           "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
//           "EServiceDescriptorDocumentAddedByTemplateUpdate",
//           "EServiceDescriptorDocumentDeletedByTemplateUpdate",
//           "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
//           "EServiceSignalHubEnabled",
//           "EServiceSignalHubDisabled"
//         ),
//       },
//       () => {
//         logger.info(
//           `No need to send a notification email for ${decodedMessage.type} message`
//         );
//       }
//     )
//     .exhaustive();
// }

// export async function handlePurposeMessage(
//   decodedMessage: PurposeEventEnvelopeV2,
//   notificationEmailSenderService: NotificationEmailSenderService,
//   logger: Logger
// ): Promise<void> {
//   await match(decodedMessage)
//     .with(
//       { type: "NewPurposeVersionWaitingForApproval" },
//       async ({ data: { purpose } }) => {
//         if (purpose) {
//           await notificationEmailSenderService.sendNewPurposeVersionWaitingForApprovalEmail(
//             purpose,
//             logger
//           );
//         } else {
//           throw missingKafkaMessageDataError("purpose", decodedMessage.type);
//         }
//       }
//     )
//     .with(
//       { type: "PurposeWaitingForApproval" },
//       async ({ data: { purpose } }) => {
//         if (purpose) {
//           await notificationEmailSenderService.sendPurposeWaitingForApprovalEmail(
//             purpose,
//             logger
//           );
//         } else {
//           throw missingKafkaMessageDataError("purpose", decodedMessage.type);
//         }
//       }
//     )
//     .with({ type: "PurposeVersionRejected" }, async ({ data: { purpose } }) => {
//       if (purpose) {
//         await notificationEmailSenderService.sendPurposeVersionRejectedEmail(
//           purpose,
//           logger
//         );
//       } else {
//         throw missingKafkaMessageDataError("purpose", decodedMessage.type);
//       }
//     })
//     .with(
//       { type: "PurposeVersionActivated" },
//       async ({ data: { purpose } }) => {
//         if (purpose) {
//           await notificationEmailSenderService.sendPurposeVersionActivatedEmail(
//             purpose,
//             logger
//           );
//         } else {
//           throw missingKafkaMessageDataError("purpose", decodedMessage.type);
//         }
//       }
//     )
//     .with(
//       {
//         type: P.union(
//           "DraftPurposeDeleted",
//           "WaitingForApprovalPurposeDeleted",
//           "PurposeAdded",
//           "DraftPurposeUpdated",
//           "PurposeActivated",
//           "PurposeArchived",
//           "PurposeVersionOverQuotaUnsuspended",
//           "PurposeVersionSuspendedByConsumer",
//           "PurposeVersionSuspendedByProducer",
//           "PurposeVersionUnsuspendedByConsumer",
//           "PurposeVersionUnsuspendedByProducer",
//           "WaitingForApprovalPurposeVersionDeleted",
//           "NewPurposeVersionActivated",
//           "PurposeCloned",
//           "PurposeDeletedByRevokedDelegation",
//           "PurposeVersionArchivedByRevokedDelegation"
//         ),
//       },
//       () => {
//         logger.info(
//           `No need to send a notification email for ${decodedMessage.type} message`
//         );
//       }
//     )
//     .exhaustive();
// }

// export async function handleAgreementMessage(
//   decodedMessage: AgreementEventEnvelopeV2,
//   notificationEmailSenderService: NotificationEmailSenderService,
//   logger: Logger
// ): Promise<void> {
//   await match(decodedMessage)
//     .with({ type: "AgreementActivated" }, async ({ data: { agreement } }) => {
//       if (agreement) {
//         await notificationEmailSenderService.sendAgreementActivatedEmail(
//           agreement,
//           logger
//         );
//       } else {
//         throw missingKafkaMessageDataError("agreement", decodedMessage.type);
//       }
//     })
//     .with({ type: "AgreementSubmitted" }, async ({ data: { agreement } }) => {
//       if (agreement) {
//         await notificationEmailSenderService.sendAgreementSubmittedEmail(
//           agreement,
//           logger
//         );
//       } else {
//         throw missingKafkaMessageDataError("agreement", decodedMessage.type);
//       }
//     })
//     .with({ type: "AgreementRejected" }, async ({ data: { agreement } }) => {
//       if (agreement) {
//         await notificationEmailSenderService.sendAgreementRejectedEmail(
//           agreement,
//           logger
//         );
//       } else {
//         throw missingKafkaMessageDataError("agreement", decodedMessage.type);
//       }
//     })
//     .with(
//       {
//         type: P.union(
//           "AgreementAdded",
//           "AgreementDeleted",
//           "DraftAgreementUpdated",
//           "AgreementUnsuspendedByProducer",
//           "AgreementUnsuspendedByConsumer",
//           "AgreementUnsuspendedByPlatform",
//           "AgreementArchivedByConsumer",
//           "AgreementArchivedByUpgrade",
//           "AgreementUpgraded",
//           "AgreementSuspendedByProducer",
//           "AgreementSuspendedByConsumer",
//           "AgreementSuspendedByPlatform",
//           "AgreementConsumerDocumentAdded",
//           "AgreementConsumerDocumentRemoved",
//           "AgreementSetDraftByPlatform",
//           "AgreementSetMissingCertifiedAttributesByPlatform",
//           "AgreementDeletedByRevokedDelegation",
//           "AgreementArchivedByRevokedDelegation"
//         ),
//       },
//       () => {
//         logger.info(
//           `No need to send a notification email for ${decodedMessage.type} message`
//         );
//       }
//     )
//     .exhaustive();
// }
