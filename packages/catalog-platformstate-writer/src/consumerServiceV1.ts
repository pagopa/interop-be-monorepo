import { match } from "ts-pattern";
import {
  descriptorState,
  EServiceEventEnvelopeV1,
  EServiceId,
  fromDescriptorV1,
  genericInternalError,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesCatalogEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deleteCatalogEntry,
  descriptorStateToClientState,
  readCatalogEntry,
  updateDescriptorStateInPlatformStatesEntry,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: EServiceEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    // EServiceDescriptorPublished -> EServiceDescriptorUpdated
    // EServiceDescriptorActivated,EServiceDescriptorSuspended -> EServiceDescriptorUpdated
    // EServiceDescriptorArchived -> EServiceDescriptorUpdated
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
      match(descriptor.state)
        .with(descriptorState.published, async () => {
          // steps:
          // capire se siamo in (draft -> published) o (suspened -> published)
          // fare query su platform states e vedere se c'è
          // se non c'è sono in draft, e continuo questa esecuzione
          // se c'è (presumibilmente come inactive) allora era suspended e sono nel caso sotto (sospensione e riattivazione hanno stesso handler)

          const existingCatalogEntry = await readCatalogEntry(
            eserviceDescriptorPK,
            dynamoDBClient
          );

          if (!existingCatalogEntry) {
            // the descriptor was draft so there was not an entry in platform-states
            const catalogEntry: PlatformStatesCatalogEntry = {
              PK: eserviceDescriptorPK,
              state: descriptorStateToClientState(descriptor.state),
              descriptorAudience: descriptor.audience[0],
              version: msg.version,
              updatedAt: new Date().toISOString(),
            };
            await writeCatalogEntry(catalogEntry, dynamoDBClient);

            // TO DO token-generation-states part
          } else {
            // activation from suspended
            await updateDescriptorStateInPlatformStatesEntry(
              dynamoDBClient,
              existingCatalogEntry.PK,
              descriptorStateToClientState(descriptor.state),
              msg.version
            );

            // TO DO token-generation-states part
          }
        })
        .with(descriptorState.suspended, async () => {
          await updateDescriptorStateInPlatformStatesEntry(
            dynamoDBClient,
            eserviceDescriptorPK,
            descriptorStateToClientState(descriptor.state),
            msg.version
          );

          // TO DO token-generation-states part
        })
        .with(descriptorState.archived, async () => {
          const eserviceId = msg.data.eserviceId;
          const descriptorV1 = msg.data.eserviceDescriptor;
          if (!descriptorV1) {
            throw genericInternalError(
              `EServiceDescriptor not found in message data for event ${msg.type}`
            );
          }
          const descriptor = fromDescriptorV1(descriptorV1);

          const primaryKey = `ESERVICEDESCRIPTOR#${eserviceId}#${descriptor.id}`;
          await deleteCatalogEntry(primaryKey, dynamoDBClient);
        })
        .with(descriptorState.draft, descriptorState.deprecated, () =>
          Promise.resolve()
        );
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
