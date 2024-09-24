import { match } from "ts-pattern";
import {
  Descriptor,
  descriptorState,
  EServiceDescriptorV1,
  EServiceEventEnvelopeV1,
  EServiceId,
  fromDescriptorV1,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  missingKafkaMessageDataError,
  PlatformStatesCatalogEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDescriptorUpdated" }, async (msg) => {
      const eserviceId = unsafeBrandId<EServiceId>(msg.data.eserviceId);
      const descriptor = parseDescriptor(msg.data.eserviceDescriptor, msg.type);

      const eserviceDescriptorPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId,
        descriptorId: descriptor.id,
      });
      await match(descriptor.state)
        .with(descriptorState.published, async () => {
          const existingCatalogEntry = await readCatalogEntry(
            eserviceDescriptorPK,
            dynamoDBClient
          );

          if (
            existingCatalogEntry &&
            existingCatalogEntry.version > msg.version
          ) {
            // Stops processing if the message is older than the catalog entry
            return Promise.resolve();
          } else if (
            existingCatalogEntry &&
            existingCatalogEntry.version <= msg.version
          ) {
            // suspended->published

            await updateDescriptorStateInPlatformStatesEntry(
              dynamoDBClient,
              eserviceDescriptorPK,
              descriptorStateToItemState(descriptor.state),
              msg.version
            );

            // token-generation-states
            const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
              eserviceId,
              descriptorId: descriptor.id,
            });
            await updateDescriptorStateInTokenGenerationStatesTable(
              eserviceId_descriptorId,
              descriptorStateToItemState(descriptor.state),
              dynamoDBClient
            );
          } else {
            const catalogEntry: PlatformStatesCatalogEntry = {
              PK: eserviceDescriptorPK,
              state: descriptorStateToItemState(descriptor.state),
              descriptorAudience: descriptor.audience[0],
              descriptorVoucherLifespan: descriptor.voucherLifespan,
              version: msg.version,
              updatedAt: new Date().toISOString(),
            };

            await writeCatalogEntry(catalogEntry, dynamoDBClient);

            // token-generation-states
            const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
              eserviceId,
              descriptorId: descriptor.id,
            });
            await updateDescriptorStateInTokenGenerationStatesTable(
              eserviceId_descriptorId,
              descriptorStateToItemState(descriptor.state),
              dynamoDBClient
            );
          }
        })
        .with(descriptorState.suspended, async () => {
          const existingCatalogEntry = await readCatalogEntry(
            eserviceDescriptorPK,
            dynamoDBClient
          );

          if (
            !existingCatalogEntry ||
            existingCatalogEntry.version > msg.version
          ) {
            return Promise.resolve();
          } else {
            // platform-states
            await updateDescriptorStateInPlatformStatesEntry(
              dynamoDBClient,
              eserviceDescriptorPK,
              descriptorStateToItemState(descriptor.state),
              msg.version
            );

            // token-generation-states
            const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
              eserviceId,
              descriptorId: descriptor.id,
            });
            await updateDescriptorStateInTokenGenerationStatesTable(
              eserviceId_descriptorId,
              descriptorStateToItemState(descriptor.state),
              dynamoDBClient
            );
          }
        })
        .with(descriptorState.archived, async () => {
          const eserviceId = unsafeBrandId<EServiceId>(msg.data.eserviceId);
          const descriptor = parseDescriptor(
            msg.data.eserviceDescriptor,
            msg.type
          );

          // platform-states
          const primaryKey = makePlatformStatesEServiceDescriptorPK({
            eserviceId,
            descriptorId: descriptor.id,
          });
          await deleteCatalogEntry(primaryKey, dynamoDBClient);

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient
          );
        })
        .with(descriptorState.draft, descriptorState.deprecated, () =>
          Promise.resolve()
        )
        .exhaustive();
    })
    .with(
      { type: "EServiceAdded" },
      { type: "ClonedEServiceAdded" },
      { type: "EServiceUpdated" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "MovedAttributesFromEserviceToDescriptors" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceWithDescriptorsDeleted" },
      { type: "EServiceDocumentUpdated" },
      { type: "EServiceDeleted" },
      { type: "EServiceDocumentAdded" },
      { type: "EServiceDocumentDeleted" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceRiskAnalysisDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}

export const parseDescriptor = (
  descriptorV1: EServiceDescriptorV1 | undefined,
  eventType: string
): Descriptor => {
  if (!descriptorV1) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }
  return fromDescriptorV1(descriptorV1);
};
