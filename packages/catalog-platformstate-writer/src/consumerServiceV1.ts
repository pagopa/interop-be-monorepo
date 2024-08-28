import { match } from "ts-pattern";
import {
  descriptorState,
  EServiceEventEnvelopeV1,
  fromDescriptorV1,
  genericInternalError,
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deleteCatalogEntry,
  descriptorStateToClientState,
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
      const eserviceId = msg.data.eserviceId;
      const descriptorV1 = msg.data.eserviceDescriptor;
      if (!descriptorV1) {
        throw genericInternalError(
          `EServiceDescriptor not found in message data for event ${msg.type}`
        );
      }
      const descriptor = fromDescriptorV1(descriptorV1);

      match(descriptor.state)
        .with(
          descriptorState.published,
          descriptorState.suspended,
          async () => {
            console.log(descriptor.state);
            const catalogEntry: PlatformStatesCatalogEntry = {
              // TODO: change with the PK type
              PK: `ESERVICEDESCRIPTOR#${eserviceId}#${descriptor.id}`,
              state: descriptorStateToClientState(descriptor.state),
              descriptorAudience: descriptor.audience[0],
            };
            console.log(catalogEntry);
            await writeCatalogEntry(catalogEntry, dynamoDBClient);
          }
        )
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
