import { Logger } from "pagopa-interop-commons";
import { NewNotification, EServiceEventEnvelope } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleEserviceArchivingCanceledToConsumer } from "./handleEserviceArchivingCanceledToConsumer.js";
import { handleEserviceArchivingCanceledToProducer } from "./handleEserviceArchivingCanceledToProducer.js";
import { handleEserviceArchivingRequestApprovedRejectedToDelegate } from "./handleEserviceArchivingRequestApprovedRejectedToDelegate.js";
import { handleEserviceArchivingRequestCanceledToDelegate } from "./handleEserviceArchivingRequestCanceledToDelegate.js";
import { handleEserviceArchivingRequestCanceledToProducer } from "./handleEserviceArchivingRequestCanceledToProducer.js";
import { handleEserviceArchivingRequestedToDelegator } from "./handleEserviceArchivingRequestedToDelegator.js";
import { handleEserviceArchivingToConsumer } from "./handleEserviceArchivingToConsumer.js";
import { handleEserviceArchivingToProducer } from "./handleEserviceArchivingToProducer.js";
import { handleEserviceNameUpdatedByTemplateUpdateToInstantiator } from "./handleEserviceNameUpdatedByTemplateUpdateToInstantiator.js";
import { handleEserviceNewVersionApprovedRejectedToDelegate } from "./handleEserviceNewVersionApprovedRejectedToDelegate.js";
import { handleEserviceNewVersionSubmittedToDelegator } from "./handleEserviceNewVersionSubmittedToDelegator.js";
import { handleEserviceStateChangedToConsumer } from "./handleEserviceStateChangedToConsumer.js";
import { handleEserviceStateChangedToProducer } from "./handleEserviceStateChangedToProducer.js";

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
    .with({ type: "EServiceNameUpdatedByTemplateUpdate" }, async (msg) => {
      const [instantiator, cons] = await Promise.all([
        handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
          msg,
          logger,
          readModelService
        ),
        handleEserviceStateChangedToConsumer(msg, logger, readModelService),
      ]);
      return [...instantiator, ...cons];
    })
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
      async (msg) => {
        const [prod, cons] = await Promise.all([
          handleEserviceArchivingCanceledToProducer(
            msg,
            logger,
            readModelService
          ),
          handleEserviceArchivingCanceledToConsumer(
            msg,
            logger,
            readModelService
          ),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorArchivingRequestedByDelegate",
          "EServiceArchivingRequestedByDelegate"
        ),
      },
      (msg) =>
        handleEserviceArchivingRequestedToDelegator(
          msg,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorArchivingRequestApprovedByDelegator",
          "EServiceDescriptorArchivingRequestRejectedByDelegator",
          "EServiceArchivingRequestApprovedByDelegator",
          "EServiceArchivingRequestRejectedByDelegator"
        ),
      },
      (msg) =>
        handleEserviceArchivingRequestApprovedRejectedToDelegate(
          msg,
          logger,
          readModelService
        )
    )
    .with(
      {
        type: P.union(
          "EServiceArchivingRequestCanceledByDelegate",
          "EServiceDescriptorArchivingRequestCanceledByDelegate"
        ),
      },
      async (msg) => {
        const [prod, delegate] = await Promise.all([
          handleEserviceArchivingRequestCanceledToProducer(
            msg,
            logger,
            readModelService
          ),
          handleEserviceArchivingRequestCanceledToDelegate(
            msg,
            logger,
            readModelService
          ),
        ]);
        return [...prod, ...delegate];
      }
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
          "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceDeleted",
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceDescriptorDocumentDeleted",
          "EServiceInstanceLabelUpdated",
          "MaintenanceEServicePersonalDataFlagReset",
          "MaintenanceEServiceDescriptorUnarchived",
          "EServiceArchivingRequestCanceledByRevokedDelegation",
          "EServiceDescriptorArchivingRequestCanceledByRevokedDelegation"
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
