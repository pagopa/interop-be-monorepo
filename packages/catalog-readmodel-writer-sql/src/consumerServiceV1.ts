import { match } from "ts-pattern";
import {
  EServiceEventEnvelopeV1,
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { CatalogWriterService } from "./catalogWriterService.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  catalogWriterService: CatalogWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      async (msg) => {
        const eserviceV1 = msg.data.eservice;
        if (!eserviceV1) {
          throw missingKafkaMessageDataError("eservice", msg.type);
        }

        return await catalogWriterService.upsertEService(
          fromEServiceV1(eserviceV1),
          msg.version
        );
      }
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await catalogWriterService.deleteDescriptorById({
          eserviceId: unsafeBrandId(msg.stream_id),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          metadataVersion: msg.version,
        })
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      const documentV1 = msg.data.updatedDocument;
      if (!documentV1) {
        throw missingKafkaMessageDataError("updatedDocument", msg.type);
      }

      await catalogWriterService.updateDocOrInterface({
        eserviceId: unsafeBrandId(msg.data.eserviceId),
        descriptorId: unsafeBrandId(msg.data.descriptorId),
        docOrInterface: fromDocumentV1(documentV1),
        metadataVersion: msg.version,
        serverUrls: msg.data.serverUrls,
      });
    })
    .with(
      { type: "EServiceDeleted" },
      async (msg) =>
        await catalogWriterService.deleteEServiceById(
          unsafeBrandId(msg.data.eserviceId),
          msg.version
        )
    )
    .with({ type: "EServiceDocumentAdded" }, async (msg) => {
      const documentV1 = msg.data.document;
      if (!documentV1) {
        throw missingKafkaMessageDataError("document", msg.type);
      }

      if (msg.data.isInterface) {
        await catalogWriterService.upsertInterface({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          descriptorInterface: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
          serverUrls: msg.data.serverUrls,
        });
      } else {
        await catalogWriterService.upsertDocument({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          document: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
        });
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await catalogWriterService.deleteDocumentOrInterface({
        eserviceId: unsafeBrandId(msg.data.eserviceId),
        descriptorId: unsafeBrandId(msg.data.descriptorId),
        documentId: unsafeBrandId(msg.data.documentId),
        metadataVersion: msg.version,
      });
    })
    .with(
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDescriptorUpdated" },
      async (msg) => {
        const descriptorV1 = msg.data.eserviceDescriptor;
        if (!descriptorV1) {
          throw missingKafkaMessageDataError("eserviceDescriptor", msg.type);
        }

        await catalogWriterService.upsertDescriptor({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptor: fromDescriptorV1(descriptorV1),
          metadataVersion: msg.version,
        });
      }
    )
    .exhaustive();
}
