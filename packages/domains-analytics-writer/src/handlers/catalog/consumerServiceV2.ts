/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import { EService, EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitEserviceIntoObjectsSQL } from "pagopa-interop-readmodel";
import { EServiceItemsSQL } from "pagopa-interop-readmodel-models";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";

export async function handleCatalogMessageV2(
  messages: EServiceEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  const upsertBatch: EServiceItemsSQL[] = [];
  const deleteEServiceBatch: string[] = [];
  const deleteDescriptorBatch: string[] = [];
  const deleteEServiceDocumentBatch: string[] = [];
  const deleteEserviceRiskAnalysisBatch: string[] = [];
  const deleteEserviceInterfaceBatch: string[] = [];

  for (const message of messages) {
    await match(message)
      .with({ type: "EServiceDeleted" }, async (msg) => {
        deleteEServiceBatch.push(msg.data.eserviceId);
      })
      .with(
        { type: P.union("EServiceDraftDescriptorDeleted") },
        async (msg) => {
          deleteDescriptorBatch.push(msg.data.descriptorId);
        }
      )
      .with(
        { type: P.union("EServiceDescriptorDocumentDeleted") },
        async (msg) => {
          deleteEServiceDocumentBatch.push(msg.data.descriptorId);
        }
      )
      .with({ type: P.union("EServiceRiskAnalysisDeleted") }, async (msg) => {
        deleteEserviceRiskAnalysisBatch.push(msg.data.riskAnalysisId);
      })
      .with(
        {
          type: P.union(
            "EServiceDescriptorDocumentDeletedByTemplateUpdate",
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate"
          ),
        },
        async (msg) => {
          deleteEServiceDocumentBatch.push(msg.data.documentId);
        }
      )
      .with(
        { type: P.union("EServiceDescriptorInterfaceDeleted") },
        async (msg) => {
          deleteEserviceInterfaceBatch.push(msg.data.descriptorId);
        }
      )
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceCloned",
            "EServiceDescriptorAdded",
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
            "EServiceRiskAnalysisAdded",
            "EServiceRiskAnalysisUpdated",
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
            "EServiceDescriptorDocumentAddedByTemplateUpdate"
          ),
        },
        async (msg) => {
          const splitResult: EServiceItemsSQL = splitEserviceIntoObjectsSQL(
            EService.parse(msg.data.eservice),
            msg.version
          );
          upsertBatch.push(splitResult);
        }
      )
      .exhaustive();
  }

  if (upsertBatch.length > 0) {
    await catalogService.upsertBatchEservice(upsertBatch, dbContext);
  }
  if (deleteEServiceBatch.length > 0) {
    await catalogService.deleteBatchEService(deleteEServiceBatch, dbContext);
  }
  if (deleteDescriptorBatch.length > 0) {
    await catalogService.deleteBatchDescriptor(
      deleteDescriptorBatch,
      dbContext
    );
  }
  if (deleteEServiceDocumentBatch.length > 0) {
    await catalogService.deleteBatchEServiceDocument(
      deleteEServiceDocumentBatch,
      dbContext
    );
  }
  if (deleteEserviceRiskAnalysisBatch.length > 0) {
    await catalogService.deleteBatchEserviceRiskAnalysis(
      deleteEserviceRiskAnalysisBatch,
      dbContext
    );
  }
  if (deleteEserviceInterfaceBatch.length > 0) {
    await catalogService.deleteBatchEserviceInterface(
      deleteEserviceInterfaceBatch,
      dbContext
    );
  }
}
