/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  EServiceEventEnvelopeV1,
  EServiceId,
  unsafeBrandId,
  fromDescriptorV1,
  genericInternalError,
  fromEServiceV1,
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
  EserviceDescriptorServerUrlsSchema,
} from "../../model/catalog/eserviceDescriptor.js";
import {
  EserviceDescriptorDocumentSchema,
  EserviceDescriptorDocumentDeletingSchema,
} from "../../model/catalog/eserviceDescriptorDocument.js";
import {
  EserviceDescriptorDocumentOrInterfaceDeletingSchema,
  EserviceDescriptorInterfaceItemsSchema,
  EserviceDescriptorInterfaceSchema,
} from "../../model/catalog/eserviceDescriptorInterface.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

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
  const upsertDescriptorBatch: EserviceDescriptorItemsSchema[] = [];
  const upsertEserviceInterface: EserviceDescriptorInterfaceItemsSchema[] = [];
  const upsertDescriptorServerUrls: EserviceDescriptorServerUrlsSchema[] = [];
  const deleteDescriptorDocumentOrInterfaceBatch: EserviceDescriptorDocumentOrInterfaceDeletingSchema[] =
    [];

  for (const message of messages) {
    match(message)
      .with(
        {
          type: P.union(
            "EServiceAdded",
            "ClonedEServiceAdded",
            "EServiceUpdated",
            "EServiceRiskAnalysisAdded",
            "MovedAttributesFromEserviceToDescriptors",
            "EServiceRiskAnalysisUpdated",
            "EServiceRiskAnalysisDeleted"
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
          } satisfies z.input<typeof EserviceDescriptorDeletingSchema>)
        );
      })
      .with({ type: "EServiceDocumentUpdated" }, (msg) => {
        if (!msg.data.updatedDocument) {
          throw genericInternalError(
            `EService updatedDocument can't be missing in the event message`
          );
        }
        const isInterface =
          msg.data.serverUrls && msg.data.serverUrls.length > 0;

        if (isInterface) {
          upsertEserviceInterface.push(
            EserviceDescriptorInterfaceSchema.parse({
              ...msg.data.updatedDocument,
              eserviceId: msg.data.eserviceId,
              descriptorId: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorInterfaceSchema>)
          );
          upsertDescriptorServerUrls.push(
            EserviceDescriptorServerUrlsSchema.parse({
              serverUrls: msg.data.serverUrls,
              id: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorServerUrlsSchema>)
          );
        } else {
          upsertEServiceDocumentBatch.push(
            EserviceDescriptorDocumentSchema.parse({
              ...msg.data.updatedDocument,
              eserviceId: msg.data.eserviceId,
              descriptorId: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorDocumentSchema>)
          );
        }
      })
      .with({ type: "EServiceDocumentAdded" }, (msg) => {
        if (!msg.data.document) {
          throw genericInternalError(
            `EService document can't be missing in the event message`
          );
        }

        if (msg.data.isInterface) {
          upsertEserviceInterface.push(
            EserviceDescriptorInterfaceSchema.parse({
              ...msg.data.document,
              eserviceId: msg.data.eserviceId,
              descriptorId: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorInterfaceSchema>)
          );
          upsertDescriptorServerUrls.push(
            EserviceDescriptorServerUrlsSchema.parse({
              serverUrls: msg.data.serverUrls,
              id: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorServerUrlsSchema>)
          );
        } else {
          upsertEServiceDocumentBatch.push(
            EserviceDescriptorDocumentSchema.parse({
              ...msg.data.document,
              eserviceId: msg.data.eserviceId,
              descriptorId: msg.data.descriptorId,
              metadataVersion: msg.version,
            } satisfies z.input<typeof EserviceDescriptorDocumentSchema>)
          );
        }
      })
      .with({ type: "EServiceDocumentDeleted" }, (msg) => {
        deleteDescriptorDocumentOrInterfaceBatch.push(
          EserviceDescriptorDocumentOrInterfaceDeletingSchema.parse({
            id: msg.data.documentId,
            descriptorId: msg.data.descriptorId,
            metadataVersion: msg.version,
          }) satisfies z.input<
            typeof EserviceDescriptorDocumentOrInterfaceDeletingSchema
          >
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

  if (deleteEServiceDocumentBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEServiceDocumentBatch,
      EserviceDescriptorDocumentDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEServiceDocument(dbContext, distinctBatch);
  }

  if (upsertDescriptorBatch.length > 0) {
    await catalogService.upsertBatchEServiceDescriptor(
      dbContext,
      upsertDescriptorBatch
    );
  }
  if (upsertEserviceInterface.length > 0) {
    await catalogService.upsertBatchEserviceDescriptorInterface(
      dbContext,
      upsertEserviceInterface
    );
  }

  if (upsertDescriptorServerUrls.length > 0) {
    await catalogService.upsertBatchDescriptorServerUrls(
      dbContext,
      upsertDescriptorServerUrls
    );
  }

  if (deleteDescriptorDocumentOrInterfaceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteDescriptorDocumentOrInterfaceBatch,
      EserviceDescriptorDocumentOrInterfaceDeletingSchema,
      ["id"]
    );
    await catalogService.deleteDescriptorDocumentOrInterfaceBatch(
      dbContext,
      distinctBatch
    );
  }
  if (deleteDescriptorBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteDescriptorBatch,
      EserviceDescriptorDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchDescriptor(dbContext, distinctBatch);
  }

  if (deleteEServiceBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteEServiceBatch,
      EserviceDeletingSchema,
      ["id"]
    );
    await catalogService.deleteBatchEService(dbContext, distinctBatch);
  }
}
