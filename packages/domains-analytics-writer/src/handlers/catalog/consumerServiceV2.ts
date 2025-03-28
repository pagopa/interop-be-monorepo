import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleCatalogMessageV2(
  message: EServiceEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async () => Promise.resolve())
    .with(
      P.union(
        { type: "EServiceAdded" },
        { type: "DraftEServiceUpdated" },
        { type: "EServiceCloned" },
        { type: "EServiceDescriptorAdded" },
        { type: "EServiceDraftDescriptorDeleted" },
        { type: "EServiceDraftDescriptorUpdated" },
        { type: "EServiceDescriptorQuotasUpdated" },
        { type: "EServiceDescriptorActivated" },
        { type: "EServiceDescriptorArchived" },
        { type: "EServiceDescriptorPublished" },
        { type: "EServiceDescriptorSuspended" },
        { type: "EServiceDescriptorInterfaceAdded" },
        { type: "EServiceDescriptorDocumentAdded" },
        { type: "EServiceDescriptorInterfaceUpdated" },
        { type: "EServiceDescriptorDocumentUpdated" },
        { type: "EServiceDescriptorInterfaceDeleted" },
        { type: "EServiceDescriptorDocumentDeleted" },
        { type: "EServiceRiskAnalysisAdded" },
        { type: "EServiceRiskAnalysisUpdated" },
        { type: "EServiceRiskAnalysisDeleted" },
        { type: "EServiceDescriptionUpdated" },
        { type: "EServiceDescriptorSubmittedByDelegate" },
        { type: "EServiceDescriptorApprovedByDelegator" },
        { type: "EServiceDescriptorRejectedByDelegator" },
        { type: "EServiceDescriptorAttributesUpdated" },
        { type: "EServiceNameUpdated" },
        { type: "EServiceIsConsumerDelegableEnabled" },
        { type: "EServiceIsConsumerDelegableDisabled" },
        { type: "EServiceIsClientAccessDelegableEnabled" },
        { type: "EServiceIsClientAccessDelegableDisabled" },
        { type: "EServiceNameUpdatedByTemplateUpdate" },
        { type: "EServiceDescriptionUpdatedByTemplateUpdate" },
        { type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate" },
        { type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate" },
        { type: "EServiceDescriptorDocumentAddedByTemplateUpdate" },
        { type: "EServiceDescriptorDocumentDeletedByTemplateUpdate" },
        { type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
