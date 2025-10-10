import {
  EServiceTemplateEventEnvelope,
  fromEServiceTemplateV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { EServiceTemplateWriterService } from "./eserviceTemplateWriterService.js";

export async function handleMessageV2(
  message: EServiceTemplateEventEnvelope,
  eserviceTemplateWriterService: EServiceTemplateWriterService
): Promise<void> {
  const eserviceTemplate = message.data.eserviceTemplate;

  if (!eserviceTemplate) {
    throw genericInternalError(
      "E-service template can't be missing in event message"
    );
  }

  await match(message)
    .with({ type: "EServiceTemplateDeleted" }, async (message) => {
      await eserviceTemplateWriterService.deleteEServiceTemplateById(
        unsafeBrandId(message.stream_id),
        message.version
      );
    })
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
      { type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication" },
      async (message) => {
        await eserviceTemplateWriterService.upsertEServiceTemplate(
          fromEServiceTemplateV2(eserviceTemplate),
          message.version
        );
      }
    )
    .exhaustive();
}
