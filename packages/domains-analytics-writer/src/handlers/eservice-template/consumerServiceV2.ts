import { EServiceTemplateEventEnvelope } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleEserviceTemplateMessageV2(
  messages: EServiceTemplateEventEnvelope[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with({ type: "EServiceTemplateDeleted" }, async () => Promise.resolve())
      .with(
        {
          type: P.union(
            "EServiceTemplateVersionActivated",
            "EServiceTemplateAdded",
            "EServiceTemplateIntendedTargetUpdated",
            "EServiceTemplateDescriptionUpdated",
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
            "EServiceTemplateVersionQuotasUpdated"
          ),
        },
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
