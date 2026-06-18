import { NewNotification, EServiceEventEnvelope } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";
import { handleEserviceStateChangedToProducer } from "./handleEserviceStateChangedToProducer.js";
import { handleEserviceNewVersionApprovedRejectedToDelegate } from "./handleEserviceNewVersionApprovedRejectedToDelegate.js";
import { handleEserviceNewVersionSubmittedToDelegator } from "./handleEserviceNewVersionSubmittedToDelegator.js";
import { handleEserviceArchivingToProducer } from "./handleEserviceArchivingToProducer.js";
import { handleEserviceArchivingToConsumer } from "./handleEserviceArchivingToConsumer.js";
import { handleEserviceArchivingCanceledToConsumer } from "./handleEserviceArchivingCanceledToConsumer.js";

export async function handleEServiceEvent(
  decodedMessage: EServiceEventEnvelope,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      {
        type: P.union(
          "EServiceDescriptorSuspended",
          "EServiceDescriptorActivated"
        ),
      },
      async (msg) => {
        const [prod, cons] = await Promise.all([
          handleEserviceStateChangedToProducer(msg, logger, readModelService),
          handleEserviceStateChangedToConsumer(msg, logger, readModelService),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      {
        type: P.union(
          "EServiceNameUpdated",
          "EServiceDescriptionUpdated",
          "EServiceDescriptorPublished",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptorAttributeDailyCallsPerConsumerUpdated",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      (msg) =>
        handleEserviceStateChangedToConsumer(msg, logger, readModelService)
    )
    .with(
      { type: "EServiceDescriptorSubmittedByDelegate" },
      ({ data: { eservice } }) =>
        handleEserviceNewVersionSubmittedToDelegator(
          eservice,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorRejectedByDelegator"
        ),
      },
      ({ data: { eservice }, type }) =>
        handleEserviceNewVersionApprovedRejectedToDelegate(
          eservice,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: "EServiceDescriptorArchived",
      },
      (msg) => handleEserviceArchivingToProducer(msg, logger, readModelService)
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorArchivingScheduled",
          "EServiceArchivingScheduled",
          "EServiceDescriptorArchivingCompleted",
          "EServiceArchivingCompleted"
        ),
      },
      async (msg) => {
        const [prod, cons] = await Promise.all([
          handleEserviceArchivingToProducer(msg, logger, readModelService),
          handleEserviceArchivingToConsumer(msg, logger, readModelService),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorArchivingCanceled",
          "EServiceArchivingCanceled"
        ),
      },
      (msg) =>
        handleEserviceArchivingCanceledToConsumer(msg, logger, readModelService)
    )
    .with(
      {
        type: P.union(
          "EServiceAdded",
          "EServiceCloned",
          "EServiceDeleted",
          "DraftEServiceUpdated",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorInterfaceDeleted",
          "EServiceRiskAnalysisAdded",
          "EServiceRiskAnalysisUpdated",
          "MaintenanceEServiceRiskAnalysisSetTenantKind",
          "EServiceRiskAnalysisDeleted",
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceSignalHubEnabled",
          "EServiceSignalHubDisabled",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceUpdated",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceDeleted",
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentDeleted",
          "EServiceInstanceLabelUpdated",
          "MaintenanceEServicePersonalDataFlagReset",
          "MaintenanceEServiceDescriptorUnarchived"
        ),
      },
      () => {
        logger.info(
          `Skipping in-app notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
