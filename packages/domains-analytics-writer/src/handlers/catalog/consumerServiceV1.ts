/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EService,
  EServiceEventEnvelopeV1,
  EServiceId,
  unsafeBrandId,
  Descriptor,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import // splitDescriptorIntoObjectsSQL,
// splitEserviceIntoObjectsSQL,
"pagopa-interop-readmodel";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorTemplateVersionRefSQL,
  EServiceItemsSQL,
  // EServiceItemsSQL,
} from "pagopa-interop-readmodel-models";
import {
  splitDescriptorIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";

export async function handleCatalogMessageV1(
  messages: EServiceEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const catalogService = catalogServiceBuilder(dbContext);

  const upsertEServiceBatch: Array<
    ReturnType<typeof splitEserviceIntoObjectsSQL>
  > = [];
  const deleteEServiceBatch: string[] = [];
  const deleteDescriptorBatch: string[] = [];
  const upsertEServiceDocumentBatch: EServiceDescriptorDocumentSQL[] = [];
  const deleteEServiceDocumentBatch: string[] = [];
  const deleteRiskAnalysisBatch: string[] = [];
  const upsertDescriptorBatch: Array<{
    descriptorData: {
      descriptorSQL: EServiceDescriptorSQL;
      attributesSQL: EServiceDescriptorAttributeSQL[];
      interfaceSQL: EServiceDescriptorInterfaceSQL | undefined;
      documentsSQL: EServiceDescriptorDocumentSQL[];
      rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
      templateVersionRefSQL:
        | EServiceDescriptorTemplateVersionRefSQL
        | undefined;
    };
    eserviceId: EServiceId;
    metadataVersion: number;
  }> = [];

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
          const splitResult: EServiceItemsSQL = splitEserviceIntoObjectsSQL(
            EService.parse(msg.data.eservice),
            msg.version
          );
          upsertEServiceBatch.push(splitResult);
        }
      )
      .with({ type: "EServiceDeleted" }, (msg) => {
        deleteEServiceBatch.push(msg.data.eserviceId);
      })
      .with({ type: "EServiceWithDescriptorsDeleted" }, (msg) => {
        deleteDescriptorBatch.push(msg.data.descriptorId);
      })
      .with({ type: P.union("EServiceDocumentUpdated") }, (msg) => {
        if (msg.data.updatedDocument) {
          upsertEServiceDocumentBatch.push({
            ...msg.data.updatedDocument,
            eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptorId: unsafeBrandId<EServiceId>(msg.data.descriptorId),
            metadataVersion: msg.version,
          });
        }
      })
      .with({ type: P.union("EServiceDocumentAdded") }, (msg) => {
        if (msg.data.document) {
          upsertEServiceDocumentBatch.push({
            ...msg.data.document,
            eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptorId: unsafeBrandId<EServiceId>(msg.data.descriptorId),
            metadataVersion: msg.version,
          });
        }
      })
      .with({ type: "EServiceDocumentDeleted" }, (msg) => {
        deleteEServiceDocumentBatch.push(msg.data.documentId);
      })
      .with({ type: "EServiceRiskAnalysisDeleted" }, (msg) => {
        deleteRiskAnalysisBatch.push(msg.data.riskAnalysisId);
      })
      .with(
        {
          type: P.union("EServiceDescriptorAdded", "EServiceDescriptorUpdated"),
        },
        (msg) => {
          const descriptor = Descriptor.parse(msg.data.eserviceDescriptor);
          const splitResult = splitDescriptorIntoObjectsSQL(
            unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptor,
            msg.version
          );

          upsertDescriptorBatch.push({
            descriptorData: splitResult,
            eserviceId: unsafeBrandId(splitResult.descriptorSQL.eserviceId),
            metadataVersion: splitResult.descriptorSQL.metadataVersion,
          });
        }
      )
      .exhaustive();
  }

  if (upsertEServiceBatch.length > 0) {
    await catalogService.upsertBatchEservice(upsertEServiceBatch, dbContext);
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
  if (upsertEServiceDocumentBatch.length > 0) {
    await catalogService.upsertBatchEServiceDocument(
      upsertEServiceDocumentBatch,
      dbContext
    );
  }
  if (deleteEServiceDocumentBatch.length > 0) {
    await catalogService.deleteBatchEServiceDocument(
      deleteEServiceDocumentBatch,
      dbContext
    );
  }
  if (deleteRiskAnalysisBatch.length > 0) {
    await catalogService.deleteBatchEserviceRiskAnalysis(
      deleteRiskAnalysisBatch,
      dbContext
    );
  }
  if (upsertDescriptorBatch.length > 0) {
    await catalogService.upsertBatchEServiceDescriptor(
      upsertDescriptorBatch,
      dbContext
    );
  }
}
