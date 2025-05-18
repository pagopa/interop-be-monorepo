/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  EServiceEventEnvelopeV1,
  EServiceId,
  unsafeBrandId,
  DescriptorId,
  fromDescriptorV1,
  genericInternalError,
  fromEServiceV1,
  RiskAnalysisId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  splitDescriptorIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { z } from "zod";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";
import {
  EserviceDeletingSchema,
  EserviceItemsSchema,
} from "../../model/catalog/eservice.js";
import {
  EserviceDescriptorDeletingSchema,
  EserviceDescriptorItemsSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import {
  EserviceDescriptorDocumentSchema,
  EserviceDescriptorDocumentDeletingSchema,
} from "../../model/catalog/eserviceDescriptorDocument.js";
import { EserviceRiskAnalysisDeletingSchema } from "../../model/catalog/eserviceRiskAnalysis.js";

export async function handleCatalogMessageV1(
  messages: EServiceEventEnvelopeV1[],
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

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "ClonedEServiceAdded",
            "EServiceUpdated",
            "EServiceRiskAnalysisAdded",
            "MovedAttributesFromEserviceToDescriptors",
            "EServiceRiskAnalysisUpdated"
          ),
        },
        (msg) => {
          if (!msg.data.eservice) {
            throw genericInternalError(
              `EService can't be missing in the event message`
            );
          }

          const splitResult = splitEserviceIntoObjectsSQL(
            fromEServiceV1(msg.data.eservice),
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
      .with({ type: "EServiceDeleted" }, (msg) => {
        deleteEServiceBatch.push(
          EserviceDeletingSchema.parse({
            id: msg.data.eserviceId,
            deleted: true,
          } satisfies z.input<typeof EserviceDeletingSchema>)
        );
      })
      .with({ type: "EServiceWithDescriptorsDeleted" }, (msg) => {
        deleteDescriptorBatch.push(
          EserviceDescriptorDeletingSchema.parse({
            id: msg.data.descriptorId,
            deleted: true,
          } satisfies z.input<typeof EserviceDescriptorDeletingSchema>)
        );
      })
      .with({ type: "EServiceDocumentUpdated" }, (msg) => {
        if (!msg.data.updatedDocument) {
          throw genericInternalError(
            `EService updatedDocument can't be missing in the event message`
          );
        }

        upsertEServiceDocumentBatch.push(
          EserviceDescriptorDocumentSchema.parse({
            ...msg.data.updatedDocument,
            eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
            metadataVersion: msg.version,
          } satisfies z.input<typeof EserviceDescriptorDocumentSchema>)
        );
      })
      .with({ type: "EServiceDocumentAdded" }, (msg) => {
        if (!msg.data.document) {
          throw genericInternalError(
            `EService document can't be missing in the event message`
          );
        }

        upsertEServiceDocumentBatch.push(
          EserviceDescriptorDocumentSchema.parse({
            ...msg.data.document,
            eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
            metadataVersion: msg.version,
          } satisfies z.input<typeof EserviceDescriptorDocumentSchema>)
        );
      })
      .with({ type: "EServiceDocumentDeleted" }, (msg) => {
        deleteEServiceDocumentBatch.push(
          EserviceDescriptorDocumentDeletingSchema.parse({
            id: msg.data.documentId,
            deleted: true,
          } satisfies z.input<typeof EserviceDescriptorDocumentDeletingSchema>)
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
            id: unsafeBrandId<RiskAnalysisId>(msg.data.riskAnalysisId),
            eserviceId: unsafeBrandId<EServiceId>(msg.data.eservice.id),
            deleted: true,
          } satisfies z.input<typeof EserviceRiskAnalysisDeletingSchema>)
        );
      })
      .with(
        {
          type: P.union("EServiceDescriptorAdded", "EServiceDescriptorUpdated"),
        },
        (msg) => {
          if (!msg.data.eserviceDescriptor) {
            throw genericInternalError(
              `EService Descriptor can't be missing in the event message`
            );
          }
          const splitResult = splitDescriptorIntoObjectsSQL(
            unsafeBrandId<EServiceId>(msg.data.eserviceId),
            fromDescriptorV1(msg.data.eserviceDescriptor),
            msg.version
          );

          upsertDescriptorBatch.push(
            EserviceDescriptorItemsSchema.parse({
              descriptorSQL: splitResult.descriptorSQL,
              attributesSQL: splitResult.attributesSQL,
              interfaceSQL: splitResult.interfaceSQL,
              documentsSQL: splitResult.documentsSQL,
              rejectionReasonsSQL: splitResult.rejectionReasonsSQL,
              templateVersionRefSQL: splitResult.templateVersionRefSQL,
            } satisfies z.input<typeof EserviceDescriptorItemsSchema>)
          );
        }
      )
      .exhaustive();
  }

  if (upsertEServiceBatch.length > 0) {
    await catalogService.upsertBatchEService(dbContext, upsertEServiceBatch);
  }
  if (deleteEServiceBatch.length > 0) {
    await catalogService.deleteBatchEService(dbContext, deleteEServiceBatch);
  }
  if (deleteDescriptorBatch.length > 0) {
    await catalogService.deleteBatchDescriptor(
      dbContext,
      deleteDescriptorBatch
    );
  }
  if (upsertEServiceDocumentBatch.length > 0) {
    await catalogService.upsertBatchEServiceDocument(
      dbContext,
      upsertEServiceDocumentBatch
    );
  }
  if (deleteEServiceDocumentBatch.length > 0) {
    await catalogService.deleteBatchEServiceDocument(
      dbContext,
      deleteEServiceDocumentBatch
    );
  }
  if (deleteRiskAnalysisBatch.length > 0) {
    await catalogService.deleteBatchEserviceRiskAnalysis(
      dbContext,
      deleteRiskAnalysisBatch
    );
  }
  if (upsertDescriptorBatch.length > 0) {
    await catalogService.upsertBatchEServiceDescriptor(
      dbContext,
      upsertDescriptorBatch
    );
  }
}
