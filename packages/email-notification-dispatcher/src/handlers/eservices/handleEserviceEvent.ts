import {
  EmailNotificationMessagePayload,
  EServiceEvent,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleEserviceDescriptorPublished } from "./handleEserviceDescriptorPublished.js";
import { handleEserviceDescriptorSubmittedByDelegate } from "./handleEserviceDescriptorSubmittedByDelegate.js";
import { handleEserviceDescriptorApprovedByDelegator } from "./handleEserviceDescriptorApprovedByDelegator.js";
import { handleEserviceDescriptorRejectedByDelegator } from "./handleEserviceDescriptorRejectedByDelegator.js";
import { handleEserviceDescriptorActivated } from "./handleEserviceDescriptorActivated.js";
import { handleEserviceDescriptorSuspended } from "./handleEserviceDescriptorSuspended.js";
import { handleEserviceStateChanged } from "./handleEserviceStateChanged.js";
import { handleEserviceDescriptorArchivingScheduledToProducer } from "./handleEserviceDescriptorArchivingScheduledToProducer.js";
import { handleEserviceDescriptorArchivingScheduledToConsumer } from "./handleEserviceDescriptorArchivingScheduledToConsumer.js";
import { handleEserviceArchivingScheduledToProducer } from "./handleEserviceArchivingScheduledToProducer.js";
import { handleEserviceArchivingScheduledToConsumer } from "./handleEserviceArchivingScheduledToConsumer.js";
import { handleEserviceDescriptorArchivingCompletedToProducer } from "./handleEserviceDescriptorArchivingCompletedToProducer.js";
import { handleEserviceDescriptorArchivingCompletedToConsumer } from "./handleEserviceDescriptorArchivingCompletedToConsumer.js";
import { handleEserviceArchivingCompletedToProducer } from "./handleEserviceArchivingCompletedToProducer.js";
import { handleEserviceArchivingCompletedToConsumer } from "./handleEserviceArchivingCompletedToConsumer.js";
import { handleEserviceDescriptorArchivedToProducer } from "./handleEserviceDescriptorArchivedToProducer.js";
import { handleEserviceDescriptorArchivedToConsumer } from "./handleEserviceDescriptorArchivedToConsumer.js";
import { handleEserviceArchivingCanceledToConsumer } from "./handleEserviceArchivingCanceledToConsumer.js";
import { handleEserviceDescriptorArchivingCanceledToConsumer } from "./handleEserviceDescriptorArchivingCanceledToConsumer.js";

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
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceDescriptorActivated({
          eserviceV2Msg: eservice,
          descriptorId,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorSuspended" },
      ({ data: { eservice, descriptorId } }) =>
        handleEserviceDescriptorSuspended({
          eserviceV2Msg: eservice,
          descriptorId,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
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
      async ({ data: { eservice, descriptorId } }) => {
        const [prod, cons] = await Promise.all([
          handleEserviceDescriptorArchivedToProducer({
            eserviceV2Msg: eservice,
            descriptorId,
            logger,
            readModelService,
            templateService,
            correlationId,
          }),
          handleEserviceDescriptorArchivedToConsumer({
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
      { type: "EServiceArchivingCanceled" },
      async ({ data: { eservice } }) =>
        handleEserviceArchivingCanceledToConsumer({
          eserviceV2Msg: eservice,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "EServiceDescriptorArchivingCanceled" },
      async ({ data: { eservice, descriptorId } }) =>
        handleEserviceDescriptorArchivingCanceledToConsumer({
          eserviceV2Msg: eservice,
          descriptorId,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
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
          "EServiceDescriptorDocumentDeleted",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate",
          "EServiceInstanceLabelUpdated",
          "MaintenanceEServicePersonalDataFlagReset"
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
