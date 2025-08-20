import {
  EServiceTemplateEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleTemplateStatusChangedToProducer } from "./handleTemplateStatusChangedToProducer.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  logger: Logger,
  _readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: "EServiceTemplateVersionSuspended",
      },
      ({ data: { eserviceTemplate } }) =>
        handleTemplateStatusChangedToProducer(
          eserviceTemplate,
          logger,
          _readModelService
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
          "EServiceTemplateVersionPublished",
          "EServiceTemplateNameUpdated",
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
