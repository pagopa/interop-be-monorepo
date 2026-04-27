import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
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
      {
        type: P.union(
          "EServiceAdded",
          "DraftEServiceUpdated",
          "EServiceCloned",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorDeleted",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
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
          "EServiceIsConsumerDelegableEnabled",
          "EServiceIsConsumerDelegableDisabled",
          "EServiceIsClientAccessDelegableEnabled",
          "EServiceIsClientAccessDelegableDisabled",
          "EServiceDescriptorSubmittedByDelegate",
          "EServiceDescriptorApprovedByDelegator",
          "EServiceDescriptorRejectedByDelegator",
          "EServiceDescriptorAttributesUpdated",
          "EServiceNameUpdated",
          "EServiceNameUpdatedByTemplateUpdate",
          "EServiceDescriptionUpdatedByTemplateUpdate",
          "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
          "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentAddedByTemplateUpdate",
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
          "EServiceDescriptorDocumentDeletedByTemplateUpdate",
          "EServiceSignalHubEnabled",
          "EServiceSignalHubDisabled",
          "EServicePersonalDataFlagUpdatedAfterPublication",
          "EServicePersonalDataFlagUpdatedByTemplateUpdate",
          "EServiceInstanceLabelUpdated",
          "EServiceDescriptorArchivingScheduled",
          "EServiceDescriptorArchivingCanceled",
          "EServiceDescriptorArchivingCompleted",
          "EServiceArchivingScheduled",
          "EServiceArchivingCanceled",
          "EServiceArchivingCompleted",
          "MaintenanceEServicePersonalDataFlagReset"
        ),
      },
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
