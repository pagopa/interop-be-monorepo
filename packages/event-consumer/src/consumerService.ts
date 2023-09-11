import { match } from "ts-pattern";
import { MongoClient } from "mongodb";
import { EventEnvelope } from "./model/models.js";
import { config } from "./utilities/config.js";

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
      await eservices.insertOne({
        data: msg.data,
        metadata: {
          version: msg.version,
        },
      });
    })
    .with(
      { type: "ClonedEServiceAdded" },
      async (msg) =>
        await eservices.insertOne({
          data: msg.data,
          metadata: { version: msg.version },
        })
    )
    .with(
      { type: "EServiceUpdated" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              data: msg.data.eService,
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
          { "data.id": msg.stream_id },
          {
            $pull: {
              "data.descriptors": {
                id: msg.data.descriptorId,
              },
            },
          }
        )
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $set: {
            "metadata.version": msg.version,
            "data.descriptors.$[descriptor].docs.$[doc]":
              msg.data.updatedDocument,
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
        { "data.id": msg.stream_id },
        {
          $set: {
            "data.descriptors.$[descriptor].interface":
              msg.data.updatedDocument,
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
              "data.descriptors.$[descriptor].interface": msg.data.document,
              "data.descriptors.$[descriptor].serverUrls": msg.data.serverUrls,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.document?.id,
              },
            ],
          }
        );
      } else {
        await eservices.updateMany(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor].docs": msg.data.document,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.document?.id,
              },
            ],
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
              "data.descriptors": msg.data.eServiceDescriptor,
            },
          }
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
              "data.descriptors.$[descriptor]": msg.data.eServiceDescriptor,
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
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              data: msg.data.eService,
            },
          }
        )
    )
    .exhaustive();
}
