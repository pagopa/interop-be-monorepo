import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CatalogWriterService } from "./catalogWriterService.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  catalogWriterService: CatalogWriterService
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      await catalogWriterService.deleteEServiceById(
        unsafeBrandId(message.stream_id),
        message.version
      );
    })
    .with(
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorAgreementApprovalPolicyUpdated" },
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
      { type: "EServiceIsConsumerDelegableEnabled" },
      { type: "EServiceIsConsumerDelegableDisabled" },
      { type: "EServiceIsClientAccessDelegableEnabled" },
      { type: "EServiceIsClientAccessDelegableDisabled" },
      { type: "EServiceDescriptorSubmittedByDelegate" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      { type: "EServiceDescriptorRejectedByDelegator" },
      { type: "EServiceDescriptorAttributesUpdated" },
      { type: "EServiceNameUpdated" },
      { type: "EServiceNameUpdatedByTemplateUpdate" },
      { type: "EServiceDescriptionUpdatedByTemplateUpdate" },
      { type: "EServiceDescriptorQuotasUpdatedByTemplateUpdate" },
      { type: "EServiceDescriptorAttributesUpdatedByTemplateUpdate" },
      { type: "EServiceDescriptorDocumentAddedByTemplateUpdate" },
      { type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate" },
      { type: "EServiceDescriptorDocumentDeletedByTemplateUpdate" },
      { type: "EServiceSignalHubEnabled" },
      { type: "EServiceSignalHubDisabled" },
      { type: "EServicePersonalDataFlagUpdatedAfterPublication" },
      { type: "EServicePersonalDataFlagUpdatedByTemplateUpdate" },
      { type: "EServiceInstanceLabelUpdated" },
      async (message) => {
        const eservice = message.data.eservice;
        if (!eservice) {
          throw missingKafkaMessageDataError("eservice", message.type);
        }

        return await catalogWriterService.upsertEService(
          fromEServiceV2(eservice),
          message.version
        );
      }
    )
    .exhaustive();
}
