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
    .with({ type: "EServiceDescriptorActivated" }, ({ data: { eservice } }) =>
      handleEserviceDescriptorActivated({
        eserviceV2Msg: eservice,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "EServiceDescriptorSuspended" }, ({ data: { eservice } }) =>
      handleEserviceDescriptorSuspended({
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
          userService,
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
          "EServiceDescriptorDocumentDeletedByTemplateUpdate"
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
