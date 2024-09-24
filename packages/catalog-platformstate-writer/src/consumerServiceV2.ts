import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceEventEnvelopeV2,
  EServiceV2,
  fromEServiceV2,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  missingKafkaMessageDataError,
  PlatformStatesCatalogEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDescriptorPublished" }, async (msg) => {
      const { eservice, descriptor } = parseEServiceAndDescriptor(
        msg.data.eservice,
        unsafeBrandId(msg.data.descriptorId),
        message.type
      );
      const previousDescriptor = eservice.descriptors.find(
        (d) => d.version === (Number(descriptor.version) - 1).toString()
      );

      // flow for current descriptor
      const processCurrentDescriptor = async (): Promise<void> => {
        const primaryKeyCurrent = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        });
        const existingCatalogEntryCurrent = await readCatalogEntry(
          primaryKeyCurrent,
          dynamoDBClient
        );
        if (
          existingCatalogEntryCurrent &&
          existingCatalogEntryCurrent.version > msg.version
        ) {
          // Stops processing if the message is older than the catalog entry
          return Promise.resolve();
        } else if (
          existingCatalogEntryCurrent &&
          existingCatalogEntryCurrent.version <= msg.version
        ) {
          await updateDescriptorStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKeyCurrent,
            descriptorStateToItemState(descriptor.state),
            msg.version
          );

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient
          );
        } else {
          const catalogEntry: PlatformStatesCatalogEntry = {
            PK: primaryKeyCurrent,
            state: descriptorStateToItemState(descriptor.state),
            descriptorAudience: descriptor.audience[0],
            descriptorVoucherLifespan: descriptor.voucherLifespan,
            version: msg.version,
            updatedAt: new Date().toISOString(),
          };

          await writeCatalogEntry(catalogEntry, dynamoDBClient);

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient
          );
        }
      };

      await processCurrentDescriptor();

      // flow for previous descriptor

      if (
        !previousDescriptor ||
        previousDescriptor.state !== descriptorState.archived
      ) {
        return Promise.resolve();
      } else {
        const primaryKeyPrevious = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: previousDescriptor.id,
        });

        await deleteCatalogEntry(primaryKeyPrevious, dynamoDBClient);

        // token-generation-states
        const eserviceId_descriptorId_previous =
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: previousDescriptor.id,
          });
        await updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId_previous,
          descriptorStateToItemState(previousDescriptor.state),
          dynamoDBClient
        );
      }
    })
    .with(
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorSuspended" },
      async (msg) => {
        const { eservice, descriptor } = parseEServiceAndDescriptor(
          msg.data.eservice,
          unsafeBrandId(msg.data.descriptorId),
          message.type
        );
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        });
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

        if (!catalogEntry || catalogEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          await updateDescriptorStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            descriptorStateToItemState(descriptor.state),
            msg.version
          );

          // token-generation-states
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
          });
          await updateDescriptorStateInTokenGenerationStatesTable(
            eserviceId_descriptorId,
            descriptorStateToItemState(descriptor.state),
            dynamoDBClient
          );
        }
      }
    )
    .with({ type: "EServiceDescriptorArchived" }, async (msg) => {
      const { eservice, descriptor } = parseEServiceAndDescriptor(
        msg.data.eservice,
        unsafeBrandId<DescriptorId>(msg.data.descriptorId),
        msg.type
      );

      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: unsafeBrandId<DescriptorId>(msg.data.descriptorId),
      });
      await deleteCatalogEntry(primaryKey, dynamoDBClient);

      // token-generation-states
      const descriptorId = unsafeBrandId<DescriptorId>(msg.data.descriptorId);
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId,
      });
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        descriptorStateToItemState(descriptor.state),
        dynamoDBClient
      );
    })
    .with(
      { type: "EServiceDeleted" },
      { type: "EServiceAdded" },
      { type: "DraftEServiceUpdated" },
      { type: "EServiceCloned" },
      { type: "EServiceDescriptorAdded" },
      { type: "EServiceDraftDescriptorDeleted" },
      { type: "EServiceDraftDescriptorUpdated" },
      { type: "EServiceDescriptorQuotasUpdated" },
      { type: "EServiceDescriptorInterfaceAdded" },
      { type: "EServiceDescriptorDocumentAdded" },
      { type: "EServiceDescriptorInterfaceUpdated" },
      { type: "EServiceDescriptorDocumentUpdated" },
      { type: "EServiceDescriptorInterfaceDeleted" },
      { type: "EServiceDescriptorDocumentDeleted" },
      { type: "EServiceRiskAnalysisAdded" },
      { type: "EServiceRiskAnalysisUpdated" },
      { type: "EServiceRiskAnalysisDeleted" },
      { type: "EServiceDescriptionUpdated" },
      () => Promise.resolve()
    )
    .exhaustive();
}

export const parseEServiceAndDescriptor = (
  eserviceV2: EServiceV2 | undefined,
  descriptorId: DescriptorId,
  eventType: string
): { eservice: EService; descriptor: Descriptor } => {
  if (!eserviceV2) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }

  const eservice = fromEServiceV2(eserviceV2);

  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }
  return { eservice, descriptor };
};
