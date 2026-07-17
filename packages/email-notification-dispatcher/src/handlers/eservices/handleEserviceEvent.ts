import {
  EmailNotificationMessagePayload,
  EServiceEvent,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import { HandlerParams } from "../../models/handlerParams.js";
import { handleEserviceArchivingCanceledToConsumer } from "./handleEserviceArchivingCanceledToConsumer.js";
import { handleEserviceArchivingCanceledToProducer } from "./handleEserviceArchivingCanceledToProducer.js";
import { handleEserviceArchivingCompletedToConsumer } from "./handleEserviceArchivingCompletedToConsumer.js";
import { handleEserviceArchivingCompletedToProducer } from "./handleEserviceArchivingCompletedToProducer.js";
import { handleEserviceArchivingScheduledToConsumer } from "./handleEserviceArchivingScheduledToConsumer.js";
import { handleEserviceArchivingScheduledToProducer } from "./handleEserviceArchivingScheduledToProducer.js";
import { handleEserviceDescriptorActivatedToConsumer } from "./handleEserviceDescriptorActivatedToConsumer.js";
import { handleEserviceDescriptorActivatedToProducer } from "./handleEserviceDescriptorActivatedToProducer.js";
import { handleEserviceDescriptorApprovedByDelegator } from "./handleEserviceDescriptorApprovedByDelegator.js";
import { handleEserviceDescriptorArchivedToProducer } from "./handleEserviceDescriptorArchivedToProducer.js";
import { handleEserviceDescriptorArchivingCanceledToConsumer } from "./handleEserviceDescriptorArchivingCanceledToConsumer.js";
import { handleEserviceDescriptorArchivingCanceledToProducer } from "./handleEserviceDescriptorArchivingCanceledToProducer.js";
import { handleEserviceDescriptorArchivingCompletedToConsumer } from "./handleEserviceDescriptorArchivingCompletedToConsumer.js";
import { handleEserviceDescriptorArchivingCompletedToProducer } from "./handleEserviceDescriptorArchivingCompletedToProducer.js";
import { handleEserviceDescriptorArchivingScheduledToConsumer } from "./handleEserviceDescriptorArchivingScheduledToConsumer.js";
import { handleEserviceDescriptorArchivingScheduledToProducer } from "./handleEserviceDescriptorArchivingScheduledToProducer.js";
import { handleEserviceDescriptorPublished } from "./handleEserviceDescriptorPublished.js";
import { handleEserviceDescriptorRejectedByDelegator } from "./handleEserviceDescriptorRejectedByDelegator.js";
import { handleEserviceDescriptorSubmittedByDelegate } from "./handleEserviceDescriptorSubmittedByDelegate.js";
import { handleEserviceDescriptorSuspendedToConsumer } from "./handleEserviceDescriptorSuspendedToConsumer.js";
import { handleEserviceDescriptorSuspendedToProducer } from "./handleEserviceDescriptorSuspendedToProducer.js";
import { handleEserviceStateChanged } from "./handleEserviceStateChanged.js";

export async function handleEServiceEvent(
  params: HandlerParams<typeof EServiceEvent>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      { type: "EServiceDescriptorPublished" },
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceDescriptorPublished({
          eserviceV2Msg: eservice,
          descriptorId,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorActivated" },
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorActivatedToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorActivatedToConsumer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceDescriptorSuspended" },
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorSuspendedToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorSuspendedToConsumer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceDescriptorSubmittedByDelegate" },
      ({ data: { eservice } }) =>
        handleEserviceDescriptorSubmittedByDelegate({
          eserviceV2Msg: eservice,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorApprovedByDelegator" },
      ({ data: { eservice } }) =>
        handleEserviceDescriptorApprovedByDelegator({
          eserviceV2Msg: eservice,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorRejectedByDelegator" },
      ({ data: { eservice } }) =>
        handleEserviceDescriptorRejectedByDelegator({
          eserviceV2Msg: eservice,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      {
        type: P.union(
          "EServiceNameUpdated",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAttributeDailyCallsPerConsumerUpdated",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAdded",
          "EServiceDescriptorDocumentUpdated",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      (payload) =>
        handleEserviceStateChanged({
          payload,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorArchivingScheduled" },
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorArchivingScheduledToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorArchivingScheduledToConsumer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceArchivingScheduled" },
      async ({ data: { eservice } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceArchivingScheduledToProducer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceArchivingScheduledToConsumer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingCompleted" },
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorArchivingCompletedToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorArchivingCompletedToConsumer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceArchivingCompleted" },
      async ({ data: { eservice } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceArchivingCompletedToProducer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceArchivingCompletedToConsumer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceDescriptorArchived" },
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceDescriptorArchivedToProducer({
          eserviceV2Msg: eservice,
          descriptorId,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceArchivingCanceled" },
      async ({ data: { eservice } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceArchivingCanceledToProducer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceArchivingCanceledToConsumer({
            eserviceV2Msg: eservice,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
      }
    )
    .with(
      { type: "EServiceDescriptorArchivingCanceled" },
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorArchivingCanceledToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorArchivingCanceledToConsumer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
        ]);
        return [...prod, ...cons];
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
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServiceDescriptionUpdated",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdated",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorInterfaceAdded",
          "EServiceDescriptorInterfaceUpdated",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceAdded",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceUpdated",
          "EServiceDescriptorAsyncExchangeCallbackInterfaceDeleted",
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate",
          "EServiceInstanceLabelUpdated",
          "MaintenanceEServicePersonalDataFlagReset",
          "MaintenanceEServiceDescriptorUnarchived"
        ),
      },
      () => {
        logger.info(
          `Skipping email notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .exhaustive();
}
