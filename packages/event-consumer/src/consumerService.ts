import { match } from "ts-pattern";
import { MongoClient } from "mongodb";
import { EventEnvelope } from "./model/models.js";
import { config } from "./utilities/config.js";
import {
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
} from "./model/converter.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = config;

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI);

const db = client.db(database);
const eservices = db.collection("eservices");

export async function handleMessage(message: EventEnvelope): Promise<void> {
  await match(message)
    .with({ type: "EServiceAdded" }, async (msg) => {
      await eservices.insertOne(
        {
          data: msg.data.eService
            ? fromEServiceV1(msg.data.eService)
            : undefined,
          metadata: {
            version: msg.version,
          },
        },
        { ignoreUndefined: true }
      );
    })
    .with(
      { type: "ClonedEServiceAdded" },
      async (msg) =>
        await eservices.insertOne(
          {
            data: msg.data.eService
              ? fromEServiceV1(msg.data.eService)
              : undefined,
            metadata: { version: msg.version },
          },
          { ignoreUndefined: true }
        )
    )
    .with(
      { type: "EServiceUpdated" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
              metadata: {
                version: msg.version,
              },
            },
          },
          { ignoreUndefined: true }
        )
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $pull: {
              "data.descriptors": {
                id: msg.data.descriptorId,
              },
            },
          },
          { ignoreUndefined: true }
        )
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $set: {
            "metadata.version": msg.version,
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
          ignoreUndefined: true,
        }
      );
      await eservices.updateOne(
        { "data.id": msg.stream_id },
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
            },
            {
              "descriptor.interface.id": msg.data.documentId,
            },
          ],
          ignoreUndefined: true,
        }
      );
    })
    .with(
      { type: "EServiceDeleted" },
      async (msg) => await eservices.deleteOne({ "data.id": msg.stream_id })
    )
    .with({ type: "EServiceDocumentAdded" }, async (msg) => {
      if (msg.data.isInterface) {
        await eservices.updateMany(
          { "data.id": msg.stream_id },
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
                "descriptor.id": msg.data.document?.id,
              },
            ],
            ignoreUndefined: true,
          }
        );
      } else {
        await eservices.updateMany(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor].docs": msg.data.document
                ? fromDocumentV1(msg.data.document)
                : undefined,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.document?.id,
              },
            ],
            ignoreUndefined: true,
          }
        );
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $pull: {
            "data.descriptor.$[descriptor].docs": {
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
          ignoreUndefined: true,
        }
      );
      await eservices.updateOne(
        { "data.id": msg.stream_id },
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
              "descriptor.id": msg.data.documentId,
            },
            {
              "descriptor.interface.id": msg.data.documentId,
            },
          ],
          ignoreUndefined: true,
        }
      );
    })
    .with(
      { type: "EServiceDescriptorAdded" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $push: {
              "metadata.version": msg.version,
              "data.descriptors": msg.data.eServiceDescriptor
                ? fromDescriptorV1(msg.data.eServiceDescriptor)
                : undefined,
            },
          },
          { ignoreUndefined: true }
        )
    )
    .with(
      { type: "EServiceDescriptorUpdated" },
      async (msg) =>
        await eservices.updateMany(
          { "data.id": msg.stream_id },
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
            ignoreUndefined: true,
          }
        )
    )
    .with(
      { type: "MovedAttributesFromEserviceToDescriptors" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
            },
          },
          { ignoreUndefined: true }
        )
    )
    .exhaustive();
}
