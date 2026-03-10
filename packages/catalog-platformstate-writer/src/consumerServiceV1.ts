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
import { Logger } from "pagopa-interop-commons";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorInfoInTokenGenerationStatesTable,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  upsertPlatformStatesCatalogEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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
        .with(
          descriptorState.published,
          descriptorState.deprecated,
          async () => {
            const existingCatalogEntry = await readCatalogEntry(
              eserviceDescriptorPK,
              dynamoDBClient
            );

            if (
              existingCatalogEntry &&
              existingCatalogEntry.version > msg.version
            ) {
              // Stops processing if the message is older than the catalog entry
              logger.info(
                `Skipping processing of entry ${existingCatalogEntry.PK}. Reason: a more recent entry already exists`
              );
              return Promise.resolve();
            } else {
              // draft -> published
              // suspended -> published
              // suspended -> deprecated

              const catalogEntry: PlatformStatesCatalogEntry = {
                PK: eserviceDescriptorPK,
                state: descriptorStateToItemState(descriptor.state),
                descriptorAudience: descriptor.audience,
                descriptorVoucherLifespan: descriptor.voucherLifespan,
                version: msg.version,
                updatedAt: new Date().toISOString(),
              };

              await upsertPlatformStatesCatalogEntry(
                catalogEntry,
                dynamoDBClient,
                logger
              );
            }

            // token-generation-states
            const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
              eserviceId,
              descriptorId: descriptor.id,
            });
            await updateDescriptorInfoInTokenGenerationStatesTable(
              eserviceId_descriptorId,
              descriptorStateToItemState(descriptor.state),
              descriptor.voucherLifespan,
              descriptor.audience,
              dynamoDBClient,
              logger
            );
          }
        )
        .with(descriptorState.suspended, async () => {
          const existingCatalogEntry = await readCatalogEntry(
            eserviceDescriptorPK,
            dynamoDBClient
          );

          if (
            !existingCatalogEntry ||
            existingCatalogEntry.version > msg.version
          ) {
            logger.info(
              `Skipping processing of entry ${eserviceDescriptorPK}. Reason: ${
                !existingCatalogEntry
                  ? "entry not found in platform-states"
                  : "a more recent entry already exists"
              }`
            );
            return Promise.resolve();
          } else {
            // platform-states
            await updateDescriptorStateInPlatformStatesEntry(
              dynamoDBClient,
              eserviceDescriptorPK,
              descriptorStateToItemState(descriptor.state),
              msg.version,
              logger
            );

            // token-generation-states
            const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
              eserviceId,
              descriptorId: descriptor.id,
            });
            await updateDescriptorStateInTokenGenerationStatesTable(
              eserviceId_descriptorId,
              descriptorStateToItemState(descriptor.state),
              dynamoDBClient,
              logger
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
          await deleteCatalogEntry(primaryKey, dynamoDBClient, logger);

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient,
            logger
          );
        })
        .with(descriptorState.draft, descriptorState.waitingForApproval, () => {
          logger.info(
            `Skipping processing of entry ${eserviceDescriptorPK}. Reason: state ${descriptor.state}`
          );

          return Promise.resolve();
        })
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

const parseDescriptor = (
  descriptorV1: EServiceDescriptorV1 | undefined,
  eventType: string
): Descriptor => {
  if (!descriptorV1) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }
  return fromDescriptorV1(descriptorV1);
};
