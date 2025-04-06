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
import {
  splitDescriptorIntoObjectsSQL,
  splitEserviceIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  EServiceDescriptorSQL,
  EServiceItemsSQL,
} from "pagopa-interop-readmodel-models";
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
  const upsertEServiceDocumentBatch: Array<{
    descriptorId: string;
    documentData: any;
    event_version: number;
  }> = [];
  const deleteEServiceDocumentBatch: string[] = [];
  const deleteRiskAnalysisBatch: string[] = [];
  const upsertDescriptorBatch: Array<{
    descriptorData: EServiceDescriptorSQL;
    eserviceId: EServiceId;
    metadataVersion: number;
  }> = [];

  for (const msg of messages) {
    await match(msg)
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
        async (msg) => {
          const splitResult: EServiceItemsSQL = splitEserviceIntoObjectsSQL(
            EService.parse(msg.data.eservice),
            msg.version
          );
          upsertEServiceBatch.push(splitResult);
        }
      )
      .with({ type: "EServiceDeleted" }, async (msg) => {
        deleteEServiceBatch.push(msg.data.eserviceId);
      })
      .with({ type: "EServiceWithDescriptorsDeleted" }, async (msg) => {
        deleteDescriptorBatch.push(msg.data.descriptorId);
      })
      .with(
        { type: P.union("EServiceDocumentUpdated", "EServiceDocumentAdded") },
        async (msg) => {
          upsertEServiceDocumentBatch.push({
            descriptorId: msg.data.descriptorId,
            documentData: msg.data, // todo
            event_version: msg.event_version,
          });
        }
      )
      .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
        deleteEServiceDocumentBatch.push(msg.data.descriptorId);
      })
      .with({ type: "EServiceRiskAnalysisDeleted" }, async (msg) => {
        deleteRiskAnalysisBatch.push(msg.data.riskAnalysisId);
      })
      .with(
        {
          type: P.union("EServiceDescriptorAdded", "EServiceDescriptorUpdated"),
        },
        async (msg) => {
          const descriptor = Descriptor.parse(msg.data.eserviceDescriptor);
          const splitResult = splitDescriptorIntoObjectsSQL(
            unsafeBrandId<EServiceId>(msg.data.eserviceId),
            descriptor,
            msg.version
          );

          upsertDescriptorBatch.push({
            descriptorData: splitResult.descriptorSQL,
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
