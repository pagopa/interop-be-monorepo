import { match } from "ts-pattern";
import {
  EServiceEventEnvelopeV1,
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
  genericInternalError,
  unsafeBrandId,
  EServiceId,
  DescriptorId,
  EServiceDocumentId,
} from "pagopa-interop-models";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  customReadModeService: CustomReadModelService
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

        return await customReadModeService.upsertEService(
          fromEServiceV1(eserviceV1),
          msg.version
        );
      }
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await customReadModeService.deleteDescriptor({
          eserviceId: unsafeBrandId<EServiceId>(msg.stream_id),
          descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
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

      // important: this doesn't handle interface update

      await customReadModeService.upsertDocument({
        eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
        descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
        document: fromDocumentV1(documentV1),
        metadataVersion: msg.version,
      });
    })
    .with(
      { type: "EServiceDeleted" },
      async (msg) =>
        await customReadModeService.deleteEService(
          unsafeBrandId<EServiceId>(msg.data.eserviceId),
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
        await customReadModeService.upsertInterface({
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
          descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
          descriptorInterface: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
          serverUrls: msg.data.serverUrls,
        });
      } else {
        await customReadModeService.upsertDocument({
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
          descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
          document: fromDocumentV1(documentV1),
          metadataVersion: msg.version,
        });
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await customReadModeService.deleteDocumentOrInterface({
        eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
        descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
        documentId: unsafeBrandId<EServiceDocumentId>(msg.data.documentId),
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

        await customReadModeService.upsertDescriptor({
          eserviceId: unsafeBrandId<EServiceId>(msg.data.eserviceId),
          descriptor: fromDescriptorV1(descriptorV1),
          metadataVersion: msg.version,
        });
      }
    )
    .exhaustive();
}
