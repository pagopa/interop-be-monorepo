/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EServiceEventEnvelopeV2,
  EServiceId,
  RiskAnalysisId,
  fromEServiceV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
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
  const deleteEserviceRiskAnalysisBatch: Array<{
    eserviceId: EServiceId;
    id: RiskAnalysisId;
  }> = [];
  const deleteEserviceInterfaceBatch: string[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "EServiceDeleted" }, (msg) => {
        deleteEServiceBatch.push(msg.data.eserviceId);
      })
      .with({ type: P.union("EServiceDraftDescriptorDeleted") }, (msg) => {
        deleteDescriptorBatch.push(msg.data.descriptorId);
      })
      .with({ type: P.union("EServiceDescriptorDocumentDeleted") }, (msg) => {
        deleteEServiceDocumentBatch.push(msg.data.descriptorId);
      })
      .with({ type: "EServiceRiskAnalysisDeleted" }, (msg) => {
        if (!msg.data.eservice?.id) {
          throw genericInternalError(
            "eservice can't be missing in event message"
          );
        }

        deleteEserviceRiskAnalysisBatch.push({
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eservice?.id),
          id: unsafeBrandId<RiskAnalysisId>(msg.data.riskAnalysisId),
        });
      })
      .with(
        {
          type: P.union("EServiceDescriptorDocumentDeletedByTemplateUpdate"),
        },
        (msg) => {
          deleteEServiceDocumentBatch.push(msg.data.documentId);
        }
      )
      .with({ type: P.union("EServiceDescriptorInterfaceDeleted") }, (msg) => {
        deleteEserviceInterfaceBatch.push(msg.data.descriptorId);
      })
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "DraftEServiceUpdated",
            "EServiceCloned",
            "EServiceDescriptorAdded",
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
            "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
            "EServiceDescriptorQuotasUpdatedByTemplateUpdate",
            "EServiceDescriptorAttributesUpdatedByTemplateUpdate",
            "EServiceDescriptorDocumentAddedByTemplateUpdate"
          ),
        },
        (msg) => {
          if (!msg.data.eservice) {
            throw genericInternalError(
              `EService can't be missing in the event message`
            );
          }
          const splitResult: EServiceItemsSQL = splitEserviceIntoObjectsSQL(
            fromEServiceV2(msg.data.eservice),
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
