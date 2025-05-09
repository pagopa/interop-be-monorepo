/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  EServiceEventEnvelopeV1,
  EServiceId,
  unsafeBrandId,
  DescriptorId,
  fromDescriptorV1,
  genericInternalError,
  fromEServiceV1,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorTemplateVersionRefSQL,
  EServiceItemsSQL,
} from "pagopa-interop-readmodel-models";
import {
  splitDescriptorIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import { catalogServiceBuilder } from "../../service/catalogService.js";
import { DBContext } from "../../db/db.js";

// eslint-disable-next-line sonarjs/cognitive-complexity
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
          if (!msg.data.eservice) {
            throw genericInternalError(
              `EService can't be missing in the event message`
            );
          }
          const splitResult: EServiceItemsSQL = splitEserviceIntoObjectsSQL(
            fromEServiceV1(msg.data.eservice),
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
        if (!msg.data.updatedDocument) {
          throw genericInternalError(
            `EService updatedDocument can't be missing in the event message`
          );
        }
        upsertEServiceDocumentBatch.push({
          ...msg.data.updatedDocument,
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
          descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
          metadataVersion: msg.version,
        });
      })
      .with({ type: P.union("EServiceDocumentAdded") }, (msg) => {
        if (!msg.data.document) {
          throw genericInternalError(
            `EService document can't be missing in the event message`
          );
        }
        upsertEServiceDocumentBatch.push({
          ...msg.data.document,
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
          descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
          metadataVersion: msg.version,
        });
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
