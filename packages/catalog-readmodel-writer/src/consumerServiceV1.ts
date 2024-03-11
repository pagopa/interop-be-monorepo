import { match } from "ts-pattern";
import { EServiceCollection } from "pagopa-interop-commons";
import {
  EServiceEventEnvelopeV1,
  EServiceV1,
  EServiceLegacy,
  EServiceDocumentV1,
  EServiceDescriptorV1,
  DescriptorLegacy,
  DocumentLegacy,
} from "pagopa-interop-models";
import {
  fromDescriptorV1Legacy,
  fromDocumentV1Legacy,
  fromEServiceV1Legacy,
} from "./model/legacy/eserviceLegacyConverter.js";

const toEServiceReadModel = (
  version: number,
  eservice?: EServiceV1
): { data: EServiceLegacy | undefined; metadata: { version: number } } => ({
  data: eservice ? fromEServiceV1Legacy(eservice) : undefined,
  metadata: {
    version,
  },
});

const toDocumentReadModel = (
  document: EServiceDocumentV1 | undefined
): DocumentLegacy | undefined =>
  document ? fromDocumentV1Legacy(document) : undefined;

const toDescriptorReadModel = (
  descriptor: EServiceDescriptorV1 | undefined
): DescriptorLegacy | undefined =>
  descriptor ? fromDescriptorV1Legacy(descriptor) : undefined;

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  eservices: EServiceCollection
): Promise<void> {
  await match(message)
    .with({ type: "EServiceAdded" }, async (msg) => {
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: toEServiceReadModel(msg.version, msg.data.eservice),
        },
        { upsert: true }
      );
    })
    .with(
      { type: "ClonedEServiceAdded" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $setOnInsert: toEServiceReadModel(msg.version, msg.data.eservice),
          },
          { upsert: true }
        )
    )
    .with(
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: toEServiceReadModel(msg.version, msg.data.eservice),
          }
        )
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $pull: {
              "data.descriptors": {
                id: msg.data.descriptorId,
              },
            },
            $set: {
              "metadata.version": msg.version,
            },
          }
        )
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
        {
          $set: {
            "data.descriptors.$[descriptor].docs.$[doc]": toDocumentReadModel(
              msg.data.updatedDocument
            ),
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
            },
            {
              "doc.id": msg.data.documentId,
            },
          ],
        }
      );
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $set: {
            "data.descriptors.$[descriptor].interface": toDocumentReadModel(
              msg.data.updatedDocument
            ),
            "data.descriptors.$[descriptor].serverUrls": msg.data.serverUrls,
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
              "descriptor.interface.id": msg.data.documentId,
            },
          ],
        }
      );
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        },
        {
          $set: {
            "metadata.version": msg.version,
          },
        }
      );
    })
    .with(
      { type: "EServiceDeleted" },
      async (msg) =>
        await eservices.deleteOne({
          "data.id": msg.stream_id,
          "metadata.version": { $lt: msg.version },
        })
    )
    .with({ type: "EServiceDocumentAdded" }, async (msg) => {
      if (msg.data.isInterface) {
        await eservices.updateMany(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor].interface": toDocumentReadModel(
                msg.data.document
              ),
              "data.descriptors.$[descriptor].serverUrls": msg.data.serverUrls,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.descriptorId,
              },
            ],
          }
        );
      } else {
        await eservices.updateMany(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
            },
            $push: {
              "data.descriptors.$[descriptor].docs": toDocumentReadModel(
                msg.data.document
              ),
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.descriptorId,
              },
            ],
          }
        );
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
        {
          $pull: {
            "data.descriptors.$[descriptor].docs": {
              id: msg.data.documentId,
            },
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
            },
          ],
        }
      );
      await eservices.updateOne(
        { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
        {
          $unset: {
            "data.descriptors.$[descriptor].interface": "",
          },
          $set: {
            "data.descriptors.$[descriptor].serverUrls": [],
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
              "descriptor.interface.id": msg.data.documentId,
            },
          ],
        }
      );
      await eservices.updateOne(
        { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
        {
          $set: {
            "metadata.version": msg.version,
          },
        }
      );
    })
    .with(
      { type: "EServiceDescriptorAdded" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
            },
            $push: {
              "data.descriptors": toDescriptorReadModel(
                msg.data.eserviceDescriptor
              ),
            },
          }
        )
    )
    .with(
      { type: "EServiceDescriptorUpdated" },
      async (msg) =>
        await eservices.updateMany(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor]": toDescriptorReadModel(
                msg.data.eserviceDescriptor
              ),
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.eserviceDescriptor?.id,
              },
            ],
          }
        )
    )
    .exhaustive();
}
