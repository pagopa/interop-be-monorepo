import {
  EmailNotificationMessagePayload,
  EServiceTemplateEventV2,
  EServiceTemplateVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleEServiceTemplateVersionSuspendedToCreator } from "./handleEServiceTemplateVersionSuspendedToCreator.js";
import { handleEServiceTemplateVersionPublished } from "./handleEserviceTemplateVersionPublished.js";
import { handleEServiceTemplateNameUpdated } from "./handleEserviceTemplateNameUpdated.js";
import { handleEServiceTemplateVersionSuspendedToInstantiator } from "./handleEserviceTemplateVersionSuspendedToInstantiator.js";

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
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) => [
        ...(await handleEServiceTemplateVersionSuspendedToCreator({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
          logger,
          readModelService,
          templateService,
          userService,
          correlationId,
        })),
        ...(await handleEServiceTemplateVersionSuspendedToInstantiator({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
            eserviceTemplateVersionId
          ),
          logger,
          readModelService,
          templateService,
          userService,
          correlationId,
        })),
      ]
    )
    .with(
      { type: "EServiceTemplateVersionPublished" },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) =>
        handleEServiceTemplateVersionPublished({
          eserviceTemplateV2Msg: eserviceTemplate,
          eserviceTemplateVersionId: unsafeBrandId<EServiceTemplateVersionId>(
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
      { type: "EServiceTemplateNameUpdated" },
      async ({ data: { eserviceTemplate, oldName } }) =>
        handleEServiceTemplateNameUpdated({
          eserviceTemplateV2Msg: eserviceTemplate,
          oldName,
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
