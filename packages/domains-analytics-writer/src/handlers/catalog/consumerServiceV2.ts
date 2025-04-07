import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleCatalogMessageV2(
  messages: EServiceEventEnvelopeV2[],
  _dbContext: DBContext,
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with({ type: "EServiceDeleted" }, async () => Promise.resolve())
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceCloned",
            "EServiceDescriptorAdded",
            "EServiceDraftDescriptorDeleted",
            "EServiceDraftDescriptorUpdated",
            "EServiceDescriptorQuotasUpdated",
            "EServiceDescriptorActivated",
            "EServiceDescriptorArchived",
            "EServiceDescriptorPublished",
            "EServiceDescriptorSuspended",
            "EServiceDescriptorInterfaceAdded",
            "EServiceDescriptorDocumentAdded",
            "EServiceDescriptorInterfaceUpdated",
            "EServiceDescriptorDocumentUpdated",
            "EServiceDescriptorInterfaceDeleted",
            "EServiceDescriptorDocumentDeleted",
            "EServiceRiskAnalysisAdded",
            "EServiceRiskAnalysisUpdated",
            "EServiceRiskAnalysisDeleted",
            "EServiceDescriptionUpdated",
            "EServiceDescriptorSubmittedByDelegate",
            "EServiceDescriptorApprovedByDelegator",
            "EServiceDescriptorRejectedByDelegator",
            "EServiceDescriptorAttributesUpdated",
            "EServiceNameUpdated",
            "EServiceIsConsumerDelegableEnabled",
            "EServiceIsConsumerDelegableDisabled",
            "EServiceIsClientAccessDelegableEnabled",
            "EServiceIsClientAccessDelegableDisabled",
            "EServiceNameUpdatedByTemplateUpdate",
            "EServiceDescriptionUpdatedByTemplateUpdate",
            "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
            "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentAddedByTemplateUpdate",
            "EServiceDescriptorDocumentDeletedByTemplateUpdate",
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
          ),
        },
        async () => Promise.resolve(),
      )
      .exhaustive();
  }
}
