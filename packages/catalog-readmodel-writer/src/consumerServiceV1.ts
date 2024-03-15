import { EServiceCollection } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  EServiceReadModel,
  DescriptorReadModel,
  DocumentReadModel,
  EServiceDescriptorV1,
  EServiceDocumentV1,
  EServiceEventEnvelopeV1,
  EServiceV1,
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
} from "pagopa-interop-models";
import {
  toReadModelDescriptor,
  toReadModelDocument,
  toReadModelEService,
} from "./model/legacy/eserviceAdapter.js";

const adaptEserviceToReadModel = (
  version: number,
  eservice?: EServiceV1
): { data: EServiceReadModel | undefined; metadata: { version: number } } => ({
  data: eservice ? toReadModelEService(fromEServiceV1(eservice)) : undefined,
  metadata: {
    version,
  },
});

const adaptDocumentToReadModel = (
  document: EServiceDocumentV1 | undefined
): DocumentReadModel | undefined =>
  document ? toReadModelDocument(fromDocumentV1(document)) : undefined;

const adaptDescriptorToReadModel = (
  descriptor: EServiceDescriptorV1 | undefined
): DescriptorReadModel | undefined =>
  descriptor ? toReadModelDescriptor(fromDescriptorV1(descriptor)) : undefined;

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  eservices: EServiceCollection
): Promise<void> {
  await match(message)
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $setOnInsert: adaptEserviceToReadModel(
              msg.version,
              msg.data.eservice
            ),
          },
          { upsert: true }
        )
    )
    .with(
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      async (msg) =>
        await eservices.updateOne(
          {
            "data.id": msg.stream_id,
            "metadata.version": { $lt: msg.version },
          },
          {
            $set: adaptEserviceToReadModel(msg.version, msg.data.eservice),
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
            "data.descriptors.$[descriptor].docs.$[doc]":
              adaptDocumentToReadModel(msg.data.updatedDocument),
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
            "data.descriptors.$[descriptor].interface":
              adaptDocumentToReadModel(msg.data.updatedDocument),
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
              "data.descriptors.$[descriptor].interface":
                adaptDocumentToReadModel(msg.data.document),
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
              "data.descriptors.$[descriptor].docs": adaptDocumentToReadModel(
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
              "data.descriptors": adaptDescriptorToReadModel(
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
              "data.descriptors.$[descriptor]": adaptDescriptorToReadModel(
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
