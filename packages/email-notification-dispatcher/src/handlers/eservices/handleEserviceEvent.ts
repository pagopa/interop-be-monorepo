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

export async function handleEServiceEvent(
  params: HandlerParams<typeof EServiceEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ type: "EServiceDescriptorPublished" }, ({ data: { eservice } }) =>
      handleEserviceDescriptorPublished({
        eserviceV2Msg: eservice,
        logger,
        readModelService,
        templateService,
        userService,
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
          userService,
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
          userService,
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
          userService,
          correlationId,
        })
    )
    .with(
      {
        type: P.union(
          "EServiceDescriptorActivated",
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
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
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
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
