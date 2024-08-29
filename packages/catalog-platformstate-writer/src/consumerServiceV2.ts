import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  descriptorState,
  DescriptorState,
  EServiceEventEnvelopeV2,
  fromEServiceDescriptorStateV2,
  fromEServiceV2,
  genericInternalError,
  ItemState,
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  deleteCatalogEntry,
  descriptorStateToClientState,
  readCatalogEntry,
  readTokenStateEntriesByEserviceIdAndDescriptorId,
  readTokenStateEntryByEServiceIdAndDescriptorId,
  updateDescriptorState,
  writeCatalogEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: EServiceEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "EServiceDescriptorPublished" }, async (msg) => {
      const descriptorId = msg.data.descriptorId;
      const eservice = msg.data.eservice;
      if (!eservice) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }

      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );
      if (!descriptor) {
        throw genericInternalError(
          `Unable to find descriptor with id ${descriptorId}`
        );
      }
      const descriptorState: DescriptorState = fromEServiceDescriptorStateV2(
        descriptor.state
      );
      const catalogEntry: PlatformStatesCatalogEntry = {
        // TODO: change with the PK type
        PK: `ESERVICEDESCRIPTOR#${eservice.id}#${descriptorId}`,
        state: descriptorStateToClientState(descriptorState),
        descriptorAudience: descriptor.audience[0],
        version: msg.version,
        updatedAt: new Date().toISOString(),
      };

      await writeCatalogEntry(catalogEntry, dynamoDBClient);

      // TODO: Add token-generation-states part
    })
    .with(
      { type: "EServiceDescriptorActivated" },
      { type: "EServiceDescriptorSuspended" },
      async (msg) => {
        const eserviceV2 = msg.data.eservice;
        if (!eserviceV2) {
          throw genericInternalError(
            `EService not found in message data for event ${msg.type}`
          );
        }

        const eservice = fromEServiceV2(eserviceV2);
        const descriptorId = msg.data.descriptorId;
        // TODO: change with the PK type
        const primaryKey = `ESERVICEDESCRIPTOR#${eservice.id}#${descriptorId}`;
        // TODO: remove read?
        const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);

        if (!catalogEntry) {
          throw genericInternalError(
            `Unable to find catalog entry with PK ${primaryKey}`
          );
        } else {
          const updatedCatalogEntry: PlatformStatesCatalogEntry = {
            ...catalogEntry,
            state:
              msg.type === "EServiceDescriptorActivated"
                ? ItemState.Enum.ACTIVE
                : ItemState.Enum.INACTIVE,
            version: msg.version,
            updatedAt: new Date().toISOString(),
          };
          await writeCatalogEntry(updatedCatalogEntry, dynamoDBClient);

          // token-generation-states
          const eserviceId_descriptorId = `${eservice.id}#${descriptorId}`;
          const result = await readTokenStateEntriesByEserviceIdAndDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );

          if (result) {
            for (const entry of result) {
              await updateDescriptorState(
                dynamoDBClient,
                entry.PK,
                updatedCatalogEntry.state
              );
            }
          } else {
            throw genericInternalError(
              `Unable to find token generation state entries with GSIPK_eserviceId_descriptorId ${eserviceId_descriptorId}`
            );
          }
        }
      }
    )
    .with({ type: "EServiceDescriptorArchived" }, async (msg) => {
      const eservice = msg.data.eservice;
      if (!eservice) {
        throw genericInternalError(
          `EService not found in message data for event ${msg.type}`
        );
      }

      const primaryKey = `ESERVICEDESCRIPTOR#${eservice.id}#${msg.data.descriptorId}`;
      await deleteCatalogEntry(primaryKey, dynamoDBClient);

      // token-generation-states
      const descriptorId = msg.data.descriptorId;
      const eserviceId_descriptorId = `${eservice.id}#${descriptorId}`;
      const result = await readTokenStateEntriesByEserviceIdAndDescriptorId(
        eserviceId_descriptorId,
        dynamoDBClient
      );

      if (result) {
        for (const entry of result) {
          await updateDescriptorState(
            dynamoDBClient,
            entry.PK,
            descriptorStateToClientState(descriptorState.archived)
          );
        }
      } else {
        throw genericInternalError(
          `Unable to find token generation state entry with GSIPK_eserviceId_descriptorId ${eserviceId_descriptorId}`
        );
      }
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
