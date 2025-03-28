import { EServiceTemplateEventEnvelope } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleEserviceTemplateMessageV2(
  message: EServiceTemplateEventEnvelope
): Promise<void> {
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
