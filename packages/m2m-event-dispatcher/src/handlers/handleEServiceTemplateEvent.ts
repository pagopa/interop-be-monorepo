import { EServiceTemplateEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "EServiceTemplateVersionActivated",
          "EServiceTemplateAdded",
          "EServiceTemplateIntendedTargetUpdated",
          "EServiceTemplateDescriptionUpdated",
          "EServiceTemplateDeleted",
          "EServiceTemplateDraftVersionDeleted",
          "EServiceTemplateDraftVersionUpdated",
          "EServiceTemplateDraftUpdated",
          "EServiceTemplateNameUpdated",
          "EServiceTemplateRiskAnalysisAdded",
          "EServiceTemplateRiskAnalysisDeleted",
          "EServiceTemplateRiskAnalysisUpdated",
          "EServiceTemplateVersionSuspended",
          "EServiceTemplateVersionAdded",
          "EServiceTemplateVersionAttributesUpdated",
          "EServiceTemplateVersionDocumentAdded",
          "EServiceTemplateVersionDocumentDeleted",
          "EServiceTemplateVersionDocumentUpdated",
          "EServiceTemplateVersionInterfaceAdded",
          "EServiceTemplateVersionInterfaceDeleted",
          "EServiceTemplateVersionInterfaceUpdated",
          "EServiceTemplateVersionPublished",
          "EServiceTemplateVersionQuotasUpdated",
          "EServiceTemplatePersonalDataUpdatedAfterPublish"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
