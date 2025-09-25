import { EServiceTemplateEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";

export async function handleEServiceTemplateEvent(
  decodedMessage: EServiceTemplateEventEnvelopeV2,
  _eventTimestamp: Date,
  _logger: Logger,
  _m2mEventWriterService: M2MEventWriterServiceSQL,
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
          "EServiceTemplatePersonalDataFlagUpdatedAfterPublication"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
