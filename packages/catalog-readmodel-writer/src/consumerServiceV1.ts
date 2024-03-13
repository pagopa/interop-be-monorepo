import { match } from "ts-pattern";
import { EServiceCollection } from "pagopa-interop-commons";
import { EServiceEventEnvelopeV1 } from "pagopa-interop-models";
import {
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
} from "./model/converterV1.js";

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
          $setOnInsert: {
            data: msg.data.eservice
              ? fromEServiceV1(msg.data.eservice)
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
              data: msg.data.eservice
                ? fromEServiceV1(msg.data.eservice)
                : undefined,
              metadata: { version: msg.version },
            },
          },
          { upsert: true }
        )
    )
    .with(
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: {
              data: msg.data.eservice
                ? fromEServiceV1(msg.data.eservice)
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
              "data.descriptors": msg.data.eserviceDescriptor
                ? fromDescriptorV1(msg.data.eserviceDescriptor)
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
              "data.descriptors.$[descriptor]": msg.data.eserviceDescriptor
                ? fromDescriptorV1(msg.data.eserviceDescriptor)
                : undefined,
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
              data: msg.data.eservice
                ? fromEServiceV1(msg.data.eservice)
                : undefined,
            },
          }
        )
    )
    .with(
      { type: "EServiceRiskAnalysisDeleted" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $pull: {
              "data.riskAnalysis": {
                id: msg.data.riskAnalysisId,
              },
            },
            $set: {
              "metadata.version": msg.version,
            },
          }
        )
    )
    .exhaustive();
}
