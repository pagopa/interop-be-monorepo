import { match } from "ts-pattern";
import {
  logger,
  consumerConfig,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { EServiceEventEnvelopeV2 } from "pagopa-interop-models";
import {
  // fromDescriptorV2,
  // fromDocumentV2,
  fromEServiceV2,
} from "./model/converterV2.js";

const { eservices } = ReadModelRepository.init(consumerConfig());

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2
): Promise<void> {
  logger.info(message);

  const eservice = match(message)
    .with({ type: "EServiceCloned" }, (msg) => msg.data.clonedEservice)
    .otherwise((msg) => msg.data.eservice);

  await eservices.updateOne(
    {
      "data.id": message.stream_id,
      "metadata.version": { $lt: message.version },
    },
    {
      $set: {
        data: eservice ? fromEServiceV2(eservice) : undefined,
        metadata: {
          version: message.version,
        },
      },
    }
  );

  // TODO: check if we want a simple consumer that always ovverride the entire eservice
  // with the one from the event
  // await match(message)
  //   .with({ type: "EServiceAdded" }, async (msg) => {
  //     await eservices.updateOne(
  //       {
  //         "data.id": msg.stream_id,
  //       },
  //       {
  //         $setOnInsert: {
  //           data: msg.data.eservice
  //             ? fromEServiceV2(msg.data.eservice)
  //             : undefined,
  //           metadata: {
  //             version: msg.version,
  //           },
  //         },
  //       },
  //       { upsert: true }
  //     );
  //   })
  //   .with(
  //     { type: "DraftEServiceUpdated" },
  //     async (msg) =>
  //       await eservices.updateOne(
  //         {
  //           "data.id": msg.stream_id,
  //           "metadata.version": { $lt: msg.version },
  //         },
  //         {
  //           $set: {
  //             data: msg.data.eservice
  //               ? fromEServiceV2(msg.data.eservice)
  //               : undefined,
  //             metadata: {
  //               version: msg.version,
  //             },
  //           },
  //         }
  //       )
  //   )
  //   .with(
  //     { type: "EServiceDeleted" },
  //     async (msg) =>
  //       await eservices.deleteOne({
  //         "data.id": msg.stream_id,
  //         "metadata.version": { $lt: msg.version },
  //       })
  //   )
  //   .with(
  //     { type: "EServiceCloned" },
  //     async (msg) =>
  //       await eservices.updateOne(
  //         { "data.id": msg.stream_id },
  //         {
  //           $setOnInsert: {
  //             data: msg.data.clonedEservice
  //               ? fromEServiceV2(msg.data.clonedEservice)
  //               : undefined,
  //             metadata: { version: msg.version },
  //           },
  //         },
  //         { upsert: true }
  //       )
  //   )
  //   .with({ type: "EServiceDescriptorAdded" }, async (msg) => {
  //     const descriptor = msg.data.eservice?.descriptors.find(
  //       (d) => d.id === msg.data.descriptorId
  //     );
  //
  //     await eservices.updateOne(
  //       {
  //         "data.id": msg.stream_id,
  //         "metadata.version": { $lt: msg.version },
  //       },
  //       {
  //         $set: {
  //           "metadata.version": msg.version,
  //         },
  //         $push: {
  //           "data.descriptors": descriptor
  //             ? fromDescriptorV2(descriptor)
  //             : undefined,
  //         },
  //       }
  //     );
  //   })
  //   .with(
  //     { type: "EServiceDraftDescriptorUpdated" },
  //     { type: "EServiceDescriptorActivated" },
  //     { type: "EServiceDescriptorArchived" },
  //     { type: "EServiceDescriptorPublished" },
  //     { type: "EServiceDescriptorSuspended" },
  //     async (msg) => {
  //       const descriptor = msg.data.eservice?.descriptors.find(
  //         (d) => d.id === msg.data.descriptorId
  //       );
  //       await eservices.updateMany(
  //         {
  //           "data.id": msg.stream_id,
  //           "metadata.version": { $lt: msg.version },
  //         },
  //         {
  //           $set: {
  //             "metadata.version": msg.version,
  //             "data.descriptors.$[descriptor]": descriptor
  //               ? fromDescriptorV2(descriptor)
  //               : undefined,
  //           },
  //         },
  //         {
  //           arrayFilters: [
  //             {
  //               "descriptor.id": msg.data.descriptorId,
  //             },
  //           ],
  //         }
  //       );
  //     }
  //   )
  //   .with(
  //     { type: "EServiceDescriptorDeleted" },
  //     async (msg) =>
  //       await eservices.updateOne(
  //         {
  //           "data.id": msg.stream_id,
  //           "metadata.version": { $lt: msg.version },
  //         },
  //         {
  //           $pull: {
  //             "data.descriptors": {
  //               id: msg.data.descriptorId,
  //             },
  //           },
  //           $set: {
  //             "metadata.version": msg.version,
  //           },
  //         }
  //       )
  //   )
  //   .with({ type: "EServiceDescriptorInterfaceAdded" }, async (msg) => {
  //     const document = msg.data.eservice?.descriptors.find(
  //       (d) => d.id === msg.data.descriptorId
  //     )?.interface;
  //     const serverUrls = msg.data.eservice?.descriptors.find(
  //       (d) => d.id === msg.data.descriptorId
  //     )?.serverUrls;
  //     await eservices.updateMany(
  //       {
  //         "data.id": msg.stream_id,
  //         "metadata.version": { $lt: msg.version },
  //       },
  //       {
  //         $set: {
  //           "metadata.version": msg.version,
  //           "data.descriptors.$[descriptor].interface": document
  //             ? fromDocumentV2(document)
  //             : undefined,
  //           "data.descriptors.$[descriptor].serverUrls": serverUrls,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .with({ type: "EServiceDescriptorDocumentAdded" }, async (msg) => {
  //     const document = msg.data.eservice?.descriptors
  //       .find((d) => d.id === msg.data.descriptorId)
  //       ?.docs.find((d) => d.id === msg.data.documentId);
  //     await eservices.updateMany(
  //       {
  //         "data.id": msg.stream_id,
  //         "metadata.version": { $lt: msg.version },
  //       },
  //       {
  //         $set: {
  //           "metadata.version": msg.version,
  //         },
  //         $push: {
  //           "data.descriptors.$[descriptor].docs": document
  //             ? fromDocumentV2(document)
  //             : undefined,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .with({ type: "EServiceDescriptorInterfaceUpdated" }, async (msg) => {
  //     const document = msg.data.eservice?.descriptors.find(
  //       (d) => d.id === msg.data.descriptorId
  //     )?.interface;
  //     const serverUrls = msg.data.eservice?.descriptors.find(
  //       (d) => d.id === msg.data.descriptorId
  //     )?.serverUrls;
  //     await eservices.updateOne(
  //       {
  //         "data.id": msg.stream_id,
  //         "metadata.version": { $lt: msg.version },
  //       },
  //       {
  //         $set: {
  //           "data.descriptors.$[descriptor].interface": document
  //             ? fromDocumentV2(document)
  //             : undefined,
  //           "data.descriptors.$[descriptor].serverUrls": serverUrls,
  //           "metadata.version": msg.version,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //             $or: [
  //               { "descriptor.interface": { $exists: true } },
  //               { "descriptor.interface.id": msg.data.documentId },
  //             ],
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .with({ type: "EServiceDescriptorDocumentUpdated" }, async (msg) => {
  //     const document = msg.data.eservice?.descriptors
  //       .find((d) => d.id === msg.data.descriptorId)
  //       ?.docs.find((d) => d.id === msg.data.documentId);
  //     await eservices.updateOne(
  //       { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
  //       {
  //         $set: {
  //           "metadata.version": msg.version,
  //           "data.descriptors.$[descriptor].docs.$[doc]": document
  //             ? fromDocumentV2(document)
  //             : undefined,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //             "doc.id": msg.data.documentId,
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .with({ type: "EServiceDescriptorInterfaceDeleted" }, async (msg) => {
  //     await eservices.updateOne(
  //       { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
  //       {
  //         $unset: {
  //           "data.descriptors.$[descriptor].interface": "",
  //         },
  //         $set: {
  //           "data.descriptors.$[descriptor].serverUrls": [],
  //           "metadata.version": msg.version,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //             "descriptor.interface.id": msg.data.documentId,
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .with({ type: "EServiceDescriptorDocumentDeleted" }, async (msg) => {
  //     await eservices.updateOne(
  //       { "data.id": msg.stream_id, "metadata.version": { $lt: msg.version } },
  //       {
  //         $pull: {
  //           "data.descriptors.$[descriptor].docs": {
  //             id: msg.data.documentId,
  //           },
  //         },
  //         $set: {
  //           "metadata.version": msg.version,
  //         },
  //       },
  //       {
  //         arrayFilters: [
  //           {
  //             "descriptor.id": msg.data.descriptorId,
  //           },
  //         ],
  //       }
  //     );
  //   })
  //   .exhaustive();
}
