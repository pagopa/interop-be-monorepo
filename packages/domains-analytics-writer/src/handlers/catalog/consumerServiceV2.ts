/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EService,
  EServiceEventEnvelopeV2,
  generateId,
} from "pagopa-interop-models";
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
        const mockDescriptor = {
          // testing purpose only, ignore
          id: generateId(),
          version: "1" as any,
          docs: [],
          audience: [],
          voucherLifespan: 60,
          dailyCallsPerConsumer: 10,
          dailyCallsTotal: 1000,
          createdAt: new Date() as any,
          serverUrls: ["pagopa.it"],
          attributes: {
            certified: [],
            verified: [],
            declared: [],
          },
          state: "Published" as any,
          interface: {
            name: "fileName",
            path: "filePath",
            id: generateId(),
            prettyName: "prettyName",
            contentType: "json",
            checksum: "checksum",
            uploadDate: new Date() as any,
          },
          publishedAt: new Date() as any,
          agreementApprovalPolicy: "Automatic" as any,
          rejectionReasons: [],
        };
        if (msg.data.eservice) {
          // to remove, testing purposes
          msg.data.eservice.createdAt = new Date() as any;
          msg.data.eservice.technology = "Rest" as any;
          msg.data.eservice.mode = "Receive" as any;
          msg.data.eservice.descriptors = [mockDescriptor];
        }
        const eservice = EService.parse(msg.data.eservice);
        await catalogService.upsertEService(eservice, msg.event_version);
      }
    )
    .exhaustive();
}
