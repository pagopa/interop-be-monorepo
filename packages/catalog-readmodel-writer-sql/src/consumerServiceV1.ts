import { match } from "ts-pattern";
import {
  EServiceEventEnvelopeV1,
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  customReadModelService: CustomReadModelService
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
          throw genericInternalError(
            "eservice can't be missing in event message"
          );
        }

        return await customReadModelService.upsertEService(
          fromEServiceV1(eserviceV1),
          msg.version
        );
      }
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await customReadModelService.deleteDescriptorById({
          eserviceId: unsafeBrandId(msg.stream_id),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          metadataVersion: msg.version,
        })
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      const documentV1 = msg.data.updatedDocument;

      if (!documentV1) {
        throw genericInternalError(
          "document can't be missing in event message"
        );
      }

      await customReadModelService.updateDocOrInterface({
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
        await customReadModelService.deleteEServiceById(
          unsafeBrandId(msg.data.eserviceId),
          msg.version
        )
    )
    .with({ type: "EServiceDocumentAdded" }, async (msg) => {
      const documentV1 = msg.data.document;

      if (!documentV1) {
        throw genericInternalError(
          "document can't be missing in event message"
        );
      }

      if (msg.data.isInterface) {
        await customReadModelService.upsertInterface({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          descriptorInterface: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
          serverUrls: msg.data.serverUrls,
        });
      } else {
        await customReadModelService.upsertDocument({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptorId: unsafeBrandId(msg.data.descriptorId),
          document: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
        });
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await customReadModelService.deleteDocumentOrInterface({
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
          throw genericInternalError(
            "descriptor can't be missing in event message"
          );
        }

        await customReadModelService.upsertDescriptor({
          eserviceId: unsafeBrandId(msg.data.eserviceId),
          descriptor: fromDescriptorV1(descriptorV1),
          metadataVersion: msg.version,
        });
      }
    )
    .exhaustive();
}
