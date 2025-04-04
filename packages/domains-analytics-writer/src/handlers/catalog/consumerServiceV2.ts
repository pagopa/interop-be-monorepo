/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { EService, EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";

export async function handleCatalogMessageV2(
  message: EServiceEventEnvelopeV2,
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  await match(message)
    .with({ type: "EServiceDeleted" }, async (msg) => {
      await catalogService.deleteEService(msg.data.eserviceId);
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
          "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
        ),
      },
      async (msg) => {
        const eservice = EService.parse(msg.data.eservice);
        await catalogService.upsertEService(eservice, msg.version);
      }
    )
    .exhaustive();
}
