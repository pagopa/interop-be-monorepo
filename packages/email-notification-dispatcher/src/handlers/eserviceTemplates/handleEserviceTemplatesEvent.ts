import {
  EmailNotificationMessagePayload,
  EServiceTemplateEventV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleEServiceTemplateVersionSuspendedToCreator } from "./handleEServiceTemplateVersionSuspendedToCreator.js";

export async function handleEServiceTemplateEvent(
  params: HandlerParams<typeof EServiceTemplateEventV2>
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
    .with(
      { type: "EServiceTemplateVersionSuspended" },
      ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) =>
        handleEServiceTemplateVersionSuspendedToCreator({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrand<eserviceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
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
          "EServiceTemplateVersionPublished",
          "EServiceTemplateNameUpdated",
          "EServiceTemplateAdded",
          "EServiceTemplateRiskAnalysisAdded",
          "EServiceTemplateRiskAnalysisDeleted",
          "EServiceTemplateRiskAnalysisUpdated",
          "EServiceTemplateDraftVersionUpdated",
          "EServiceTemplateDraftUpdated",
          "EServiceTemplateDraftVersionDeleted",
          "EServiceTemplateDeleted",
          "EServiceTemplateVersionInterfaceAdded",
          "EServiceTemplateVersionDocumentAdded",
          "EServiceTemplateVersionInterfaceDeleted",
          "EServiceTemplateVersionDocumentDeleted",
          "EServiceTemplateVersionInterfaceUpdated",
          "EServiceTemplateVersionDocumentUpdated",
          "EServiceTemplateIntendedTargetUpdated",
          "EServiceTemplateDescriptionUpdated",
          "EServiceTemplateVersionQuotasUpdated",
          "EServiceTemplateVersionAdded",
          "EServiceTemplateVersionAttributesUpdated",
          "EServiceTemplateVersionActivated"
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
