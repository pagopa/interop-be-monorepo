import { match } from "ts-pattern";
import { logger, EServiceCollection } from "pagopa-interop-commons";
import { EServiceEventEnvelope } from "../../models/dist/eservice/eserviceEvents.js";
import {
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
} from "./model/converter.js";

export async function handleMessage(
  message: EServiceEventEnvelope,
  eservices: EServiceCollection
): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "EServiceAdded" }, async (msg) => {
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $setOnInsert: {
            data: msg.data.eService
              ? fromEServiceV1(msg.data.eService)
              : undefined,
            metadata: {
              version: msg.version,
            },
          },
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
            $setOnInsert: {
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
              metadata: { version: msg.version },
            },
          },
          { upsert: true }
        )
    )
    .with(
      { type: "EServiceUpdated" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
              metadata: {
                version: msg.version,
              },
            },
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
            "data.descriptors.$[descriptor].docs.$[doc]": msg.data
              .updatedDocument
              ? fromDocumentV1(msg.data.updatedDocument)
              : undefined,
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
            "data.descriptors.$[descriptor].interface": msg.data.updatedDocument
              ? fromDocumentV1(msg.data.updatedDocument)
              : undefined,
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
              "data.descriptors.$[descriptor].interface": msg.data.document
                ? fromDocumentV1(msg.data.document)
                : undefined,
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
              "data.descriptors.$[descriptor].docs": msg.data.document
                ? fromDocumentV1(msg.data.document)
                : undefined,
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
              "data.descriptors": msg.data.eServiceDescriptor
                ? fromDescriptorV1(msg.data.eServiceDescriptor)
                : undefined,
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
              "data.descriptors.$[descriptor]": msg.data.eServiceDescriptor
                ? fromDescriptorV1(msg.data.eServiceDescriptor)
                : undefined,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.eServiceDescriptor?.id,
              },
            ],
          }
        )
    )
    .with(
      { type: "MovedAttributesFromEserviceToDescriptors" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              "metadata.version": msg.version,
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
            },
          }
        )
    )
    .exhaustive();
}
