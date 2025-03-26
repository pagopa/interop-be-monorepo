import { EServiceTemplateEventEnvelope } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleEserviceTemplateMessageV2(
  message: EServiceTemplateEventEnvelope
): Promise<void> {
  await match(message)
    .with({ type: "EServiceTemplateDeleted" }, async () => Promise.resolve())
    .with(
      { type: "EServiceTemplateVersionActivated" },
      { type: "EServiceTemplateAdded" },
      { type: "EServiceTemplateIntendedTargetUpdated" },
      { type: "EServiceTemplateDescriptionUpdated" },
      { type: "EServiceTemplateDraftVersionDeleted" },
      { type: "EServiceTemplateDraftVersionUpdated" },
      { type: "EServiceTemplateDraftUpdated" },
      { type: "EServiceTemplateNameUpdated" },
      { type: "EServiceTemplateRiskAnalysisAdded" },
      { type: "EServiceTemplateRiskAnalysisDeleted" },
      { type: "EServiceTemplateRiskAnalysisUpdated" },
      { type: "EServiceTemplateVersionSuspended" },
      { type: "EServiceTemplateVersionAdded" },
      { type: "EServiceTemplateVersionAttributesUpdated" },
      { type: "EServiceTemplateVersionDocumentAdded" },
      { type: "EServiceTemplateVersionDocumentDeleted" },
      { type: "EServiceTemplateVersionDocumentUpdated" },
      { type: "EServiceTemplateVersionInterfaceAdded" },
      { type: "EServiceTemplateVersionInterfaceDeleted" },
      { type: "EServiceTemplateVersionInterfaceUpdated" },
      { type: "EServiceTemplateVersionPublished" },
      { type: "EServiceTemplateVersionQuotasUpdated" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
