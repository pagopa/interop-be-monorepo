import { match } from "ts-pattern";
import {
  descriptorState,
  EServiceEventEnvelopeV1,
  EServiceId,
  fromDescriptorV1,
  genericInternalError,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
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
      const descriptorV1 = msg.data.eserviceDescriptor;
      if (!descriptorV1) {
        throw genericInternalError(
          `EServiceDescriptor not found in message data for event ${msg.type}`
        );
      }
      const descriptor = fromDescriptorV1(descriptorV1);
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
              descriptor.state,
              dynamoDBClient
            );
          } else {
            const catalogEntry: PlatformStatesCatalogEntry = {
              PK: eserviceDescriptorPK,
              state: descriptorStateToItemState(descriptor.state),
              descriptorAudience: descriptor.audience[0],
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
              descriptor.state,
              dynamoDBClient
            );
          }
        })
        .with(descriptorState.suspended, async () => {
          const existingCatalogEntry = await readCatalogEntry(
            eserviceDescriptorPK,
            dynamoDBClient
          );

          if (!existingCatalogEntry) {
            throw genericInternalError(
              `EServiceDescriptor not found in catalog for event ${msg.type}`
            );
          } else if (
            existingCatalogEntry &&
            existingCatalogEntry.version > msg.version
          ) {
            // Stops processing if the message is older than the catalog entry
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
              descriptor.state,
              dynamoDBClient
            );
          }
        })
        .with(descriptorState.archived, async () => {
          const eserviceId = unsafeBrandId<EServiceId>(msg.data.eserviceId);
          const descriptorV1 = msg.data.eserviceDescriptor;
          if (!descriptorV1) {
            throw genericInternalError(
              `EServiceDescriptor not found in message data for event ${msg.type}`
            );
          }
          const descriptor = fromDescriptorV1(descriptorV1);

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
            descriptor.state,
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
