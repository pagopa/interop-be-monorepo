/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EServiceEventEnvelopeV2,
  fromEServiceV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitEserviceIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";
import {
  EserviceItemsSchema,
  EserviceDeletingSchema,
} from "../../model/catalog/eservice.js";
import {
  EserviceDescriptorItemsSchema,
  EserviceDescriptorDeletingSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import {
  EserviceDescriptorDocumentSchema,
  EserviceDescriptorDocumentDeletingSchema,
} from "../../model/catalog/eserviceDescriptorDocument.js";
import { EserviceDescriptorInterfaceDeletingSchema } from "../../model/catalog/eserviceDescriptorInterface.js";
import { EserviceRiskAnalysisDeletingSchema } from "../../model/catalog/eserviceRiskAnalysis.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleCatalogMessageV2(
  messages: EServiceEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  const upsertEServiceBatch: EserviceItemsSchema[] = [];
  const deleteEServiceBatch: EserviceDeletingSchema[] = [];
  const deleteDescriptorBatch: EserviceDescriptorDeletingSchema[] = [];
  const upsertEServiceDocumentBatch: EserviceDescriptorDocumentSchema[] = [];
  const deleteEServiceDocumentBatch: EserviceDescriptorDocumentDeletingSchema[] =
    [];
  const deleteRiskAnalysisBatch: EserviceRiskAnalysisDeletingSchema[] = [];
  const upsertDescriptorBatch: EserviceDescriptorItemsSchema[] = [];
  const deleteInterfaceBatch: EserviceDescriptorInterfaceDeletingSchema[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "EServiceDeleted" }, (msg) => {
        deleteEServiceBatch.push(
          EserviceDeletingSchema.parse({
            id: msg.data.eserviceId,
            deleted: true,
          } satisfies z.input<typeof EserviceDeletingSchema>)
        );
      })
      .with({ type: "EServiceDraftDescriptorDeleted" }, (msg) => {
        deleteDescriptorBatch.push(
          EserviceDescriptorDeletingSchema.parse({
            id: msg.data.descriptorId,
            deleted: true,
          } satisfies z.input<typeof EserviceDescriptorDeletingSchema>)
        );
      })

      .with({ type: "EServiceDescriptorDocumentDeleted" }, (msg) => {
        deleteEServiceDocumentBatch.push(
          EserviceDescriptorDocumentDeletingSchema.parse({
            id: msg.data.descriptorId,
            deleted: true,
          } satisfies z.input<typeof EserviceDescriptorDocumentDeletingSchema>)
        );
      })
      .with(
        { type: "EServiceDescriptorDocumentDeletedByTemplateUpdate" },
        (msg) => {
          deleteEServiceDocumentBatch.push(
            EserviceDescriptorDocumentDeletingSchema.parse({
              id: msg.data.documentId,
              deleted: true,
            } satisfies z.input<typeof EserviceDescriptorDocumentDeletingSchema>)
          );
        }
      )
      .with({ type: "EServiceDescriptorInterfaceDeleted" }, (msg) => {
        deleteInterfaceBatch.push(
          EserviceDescriptorInterfaceDeletingSchema.parse({
            id: msg.data.descriptorId,
            deleted: true,
          } satisfies z.input<typeof EserviceDescriptorInterfaceDeletingSchema>)
        );
      })
      .with({ type: "EServiceRiskAnalysisDeleted" }, (msg) => {
        if (!msg.data.eservice?.id) {
          throw genericInternalError(
            "eservice can't be missing in event message"
          );
        }

        deleteRiskAnalysisBatch.push(
          EserviceRiskAnalysisDeletingSchema.parse({
            id: msg.data.riskAnalysisId,
            eserviceId: msg.data.eservice.id,
            deleted: true,
          } satisfies z.input<typeof EserviceRiskAnalysisDeletingSchema>)
        );
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
            "EServiceDescriptorDocumentAddedByTemplateUpdate",
            "EServiceSignalHubEnabled",
            "EServiceSignalHubDisabled"
          ),
        },
        (msg) => {
          if (!msg.data.eservice) {
            throw genericInternalError(
              `EService can't be missing in the event message`
            );
          }
          const splitResult = splitEserviceIntoObjectsSQL(
            fromEServiceV2(msg.data.eservice),
            msg.version
          );

          upsertEServiceBatch.push(
            EserviceItemsSchema.parse({
              eserviceSQL: splitResult.eserviceSQL,
              riskAnalysesSQL: splitResult.riskAnalysesSQL,
              riskAnalysisAnswersSQL: splitResult.riskAnalysisAnswersSQL,
              descriptorsSQL: splitResult.descriptorsSQL,
              attributesSQL: splitResult.attributesSQL,
              interfacesSQL: splitResult.interfacesSQL,
              documentsSQL: splitResult.documentsSQL,
              rejectionReasonsSQL: splitResult.rejectionReasonsSQL,
              templateVersionRefsSQL: splitResult.templateVersionRefsSQL,
            } satisfies z.input<typeof EserviceItemsSchema>)
          );
        }
      )
      .exhaustive();
  }
  if (upsertEServiceBatch.length > 0) {
    await catalogService.upsertBatchEService(dbContext, upsertEServiceBatch);
  }
  if (upsertDescriptorBatch.length > 0) {
    await catalogService.upsertBatchEServiceDescriptor(
      dbContext,
      upsertDescriptorBatch
    );
  }
  if (upsertEServiceDocumentBatch.length > 0) {
    await catalogService.upsertBatchEServiceDocument(
      dbContext,
      upsertEServiceDocumentBatch
    );
  }
  if (deleteEServiceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEServiceBatch,
      EserviceDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEService(dbContext, distinctBatch);
  }

  if (deleteDescriptorBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteDescriptorBatch,
      EserviceDescriptorDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchDescriptor(dbContext, distinctBatch);
  }

  if (deleteEServiceDocumentBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEServiceDocumentBatch,
      EserviceDescriptorDocumentDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEServiceDocument(dbContext, distinctBatch);
  }
  if (deleteRiskAnalysisBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteRiskAnalysisBatch,
      EserviceRiskAnalysisDeletingSchema,
      ["id", "eserviceId"]
    );
    await catalogService.deleteBatchEserviceRiskAnalysis(
      dbContext,
      distinctBatch
    );
  }
  if (deleteInterfaceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteInterfaceBatch,
      EserviceDescriptorInterfaceDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEserviceInterface(dbContext, distinctBatch);
  }
}
