import {
  EServiceTemplateEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../../services/userServiceSQL.js";
import { handleTemplateStatusChangedToProducer } from "./handleTemplateStatusChangedToProducer.js";
import { handleNewEserviceTemplateVersionToInstantiator } from "./handleNewEserviceTemplateVersionToInstantiator.js";
import { handleEserviceTemplateNameChangedToInstantiator } from "./handleEserviceTemplateNameChangedToInstantiator.js";
import { handleEserviceTemplateStatusChangedToInstantiator } from "./handleEserviceTemplateStatusChangedToInstantiator.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: "EServiceTemplateVersionSuspended",
      },
      async ({ data: { eserviceTemplate } }) => [
        ...(await handleTemplateStatusChangedToProducer(
          eserviceTemplate,
          logger,
          readModelService,
          userService
        )),
        ...(await handleEserviceTemplateStatusChangedToInstantiator(
          eserviceTemplate,
          logger,
          readModelService,
          userService
        )),
      ]
    )
    .with(
      {
        type: "EServiceTemplateVersionPublished",
      },
      ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) =>
        handleNewEserviceTemplateVersionToInstantiator(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService,
          userService
        )
    )
    .with(
      {
        type: "EServiceTemplateNameUpdated",
      },
      ({ data: { eserviceTemplate, oldName } }) =>
        handleEserviceTemplateNameChangedToInstantiator(
          eserviceTemplate,
          oldName,
          logger,
          readModelService,
          userService
        )
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
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
