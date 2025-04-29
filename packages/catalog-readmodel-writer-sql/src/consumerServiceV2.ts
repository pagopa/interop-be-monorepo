import {
  EService,
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  catalogReadModelService: CustomReadModelService
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDeleted" }, async (message) => {
      await catalogReadModelService.deleteEServiceById(
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
      async (message) => {
        const eservice = message.data.eservice;

        if (!eservice) {
          throw genericInternalError(
            "Eservice can't be missing in event message"
          );
        }

        // TODO improve:
        // - either avoid doing this for all eservices
        // - either move the audience parsing elsewhere
        // - ...
        const parsedEService = fromEServiceV2(eservice);
        const fixedEService: EService = {
          ...parsedEService,
          descriptors: parsedEService.descriptors.map((d) => ({
            ...d,
            audience: d.audience.map((aud) => aud.replaceAll("\u0000", "")),
          })),
        };
        return await catalogReadModelService.upsertEService(
          fixedEService,
          message.version
        );
      }
    )
    .exhaustive();
}
