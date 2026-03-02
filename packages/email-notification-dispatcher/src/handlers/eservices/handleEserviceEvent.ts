import {
  EmailNotificationMessagePayload,
  EServiceEventV2,
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

export async function handleEServiceEvent(
  params: HandlerParams<typeof EServiceEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
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
          "EServiceDescriptorArchived",
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
          "EServiceInstanceLabelUpdated"
        ),
      },
      () => {
        logger.info(
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
