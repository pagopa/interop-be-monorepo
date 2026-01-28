import {
  EServiceTemplateEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleTemplateStatusChangedToProducer } from "./handleTemplateStatusChangedToProducer.js";
import { handleNewEserviceTemplateVersionToInstantiator } from "./handleNewEserviceTemplateVersionToInstantiator.js";
import { handleEserviceTemplateNameChangedToInstantiator } from "./handleEserviceTemplateNameChangedToInstantiator.js";
import { handleEserviceTemplateStatusChangedToInstantiator } from "./handleEserviceTemplateStatusChangedToInstantiator.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: "EServiceTemplateVersionSuspended",
      },
      async ({ data: { eserviceTemplate, eserviceTemplateVersionId } }) => [
        ...(await handleTemplateStatusChangedToProducer(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
        )),
        ...(await handleEserviceTemplateStatusChangedToInstantiator(
          eserviceTemplate,
          eserviceTemplateVersionId,
          logger,
          readModelService
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
          readModelService
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
          readModelService
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
          "EServiceTemplateVersionActivated",
          "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
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
