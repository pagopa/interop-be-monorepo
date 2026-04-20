import { EServiceEventEnvelopeV2, fromEServiceV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { FileManager, Logger } from "pagopa-interop-commons";
import { EachMessagePayload } from "kafkajs";
import { exportInterface } from "./interfaceExporter.js";

export async function exportInterfaceV2(
  decodedMsg: EServiceEventEnvelopeV2,
  originalPayload: EachMessagePayload,
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  await match(decodedMsg)
    .with(
      { type: "EServiceDescriptorPublished" },
      { type: "EServiceDescriptorApprovedByDelegator" },
      async ({ data }) => {
        if (data.eservice) {
          logger.info(
            `Processing ${decodedMsg.type} message - Partition number: ${originalPayload.partition} - Offset: ${originalPayload.message.offset}`
          );
          const eservice = fromEServiceV2(data.eservice);
          const publishedDescriptor = eservice.descriptors.find(
            (d) => d.id === data.descriptorId
          );
          if (publishedDescriptor) {
            await exportInterface(
              eservice.id,
              publishedDescriptor,
              fileManager,
              logger
            );
          }
        }
      }
    )
    .with(
      {
        type: P.union(
          "EServiceAdded",
          "DraftEServiceUpdated",
          "EServiceDeleted",
          "EServiceCloned",
          "EServiceDescriptorAdded",
          "EServiceDraftDescriptorUpdated",
          "EServiceDescriptorQuotasUpdated",
          "EServiceDescriptorAgreementApprovalPolicyUpdated",
          "EServiceDescriptorActivated",
          "EServiceDescriptorArchived",
          "EServiceDescriptorSuspended",
          "EServiceDraftDescriptorDeleted",
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
          "EServiceDescriptorArchiveScheduled",
          "EServiceDescriptorArchiveScheduleCanceled",
          "EServiceDescriptorArchiveScheduleCompleted",
          "EServiceArchiveScheduled",
          "EServiceArchiveScheduleCanceled",
          "EServiceArchiveScheduleCompleted"
        ),
      },
      () => undefined
    )
    .exhaustive();
}
