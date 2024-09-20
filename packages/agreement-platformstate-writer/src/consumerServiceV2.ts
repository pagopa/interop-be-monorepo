import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  AgreementV2,
  fromAgreementV2,
  genericInternalError,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementStateToItemState,
  deleteAgreementEntry,
  isAgreementTheLatest,
  readAgreementEntry,
  readCatalogEntry,
  updateAgreementStateInPlatformStatesEntry,
  updateAgreementStateInTokenGenerationStatesTable,
  updateAgreementStateInTokenGenerationStatesTablePlusDescriptorInfo,
  writeAgreementEntry,
} from "./utils.js";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "AgreementActivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const primaryKey = makePlatformStatesAgreementPK(agreement.id);

      const existingAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      if (
        existingAgreementEntry &&
        existingAgreementEntry.version > msg.version
      ) {
        // Stops processing if the message is older than the agreement entry
        return Promise.resolve();
      } else if (
        existingAgreementEntry &&
        existingAgreementEntry.version <= msg.version
      ) {
        await updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          agreementStateToItemState(agreement.state),
          msg.version
        );

        // token-generation-states
        await updateAgreementStateInTokenGenerationStatesTable(
          GSIPK_consumerId_eserviceId,
          agreement.state,
          dynamoDBClient
        );
      } else {
        const agreementEntry: PlatformStatesAgreementEntry = {
          PK: primaryKey,
          state: agreementStateToItemState(agreement.state),
          version: msg.version,
          updatedAt: new Date().toISOString(),
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

        await writeAgreementEntry(agreementEntry, dynamoDBClient);

        const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
        });
        const catalogEntry = await readCatalogEntry(
          pkCatalogEntry,
          dynamoDBClient
        );

        if (!catalogEntry) {
          // TODO double-check
          throw genericInternalError("Catalog entry not found");
        }
        const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
        });

        // token-generation-states
        await updateAgreementStateInTokenGenerationStatesTablePlusDescriptorInfo(
          {
            GSIPK_consumerId_eserviceId,
            agreementState: agreement.state,
            dynamoDBClient,
            GSIPK_eserviceId_descriptorId,
            descriptorState: catalogEntry.state,
            descriptorAudience: catalogEntry.descriptorAudience,
          }
        );
      }
    })
    .with(
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      async (msg) => {
        const agreement = parseAgreement(msg.data.agreement);
        const primaryKey = makePlatformStatesAgreementPK(agreement.id);
        const agreementEntry = await readAgreementEntry(
          primaryKey,
          dynamoDBClient
        );

        if (!agreementEntry || agreementEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version
          );

          const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          });

          if (
            await isAgreementTheLatest(
              GSIPK_consumerId_eserviceId,
              agreement.id,
              dynamoDBClient
            )
          ) {
            // token-generation-states only if agreement is the latest

            await updateAgreementStateInTokenGenerationStatesTable(
              GSIPK_consumerId_eserviceId,
              agreement.state,
              dynamoDBClient
            );
          }
        }
      }
    )
    .with({ type: "AgreementUpgraded" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const primaryKey = makePlatformStatesAgreementPK(agreement.id);
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      if (agreementEntry && agreementEntry.version > msg.version) {
        return Promise.resolve();
      }
      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const catalogEntry = await readCatalogEntry(
        pkCatalogEntry,
        dynamoDBClient
      );
      if (!catalogEntry) {
        throw genericInternalError("Catalog entry not found");
      }

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      if (agreementEntry && agreementEntry.version <= msg.version) {
        await updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          agreementStateToItemState(agreement.state),
          msg.version
        );
      } else {
        const newAgreementEntry: PlatformStatesAgreementEntry = {
          PK: primaryKey,
          state: agreementStateToItemState(agreement.state),
          version: msg.version,
          updatedAt: new Date().toISOString(),
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

        await writeAgreementEntry(newAgreementEntry, dynamoDBClient);
      }
      const doOperationOnTokenStates = async (): Promise<void> => {
        if (
          await isAgreementTheLatest(
            GSIPK_consumerId_eserviceId,
            agreement.id,
            dynamoDBClient
          )
        ) {
          // token-generation-states only if agreement is the latest
          const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId(
            {
              eserviceId: agreement.eserviceId,
              descriptorId: agreement.descriptorId,
            }
          );

          await updateAgreementStateInTokenGenerationStatesTablePlusDescriptorInfo(
            {
              GSIPK_consumerId_eserviceId,
              agreementState: agreement.state,
              dynamoDBClient,
              GSIPK_eserviceId_descriptorId,
              descriptorState: catalogEntry.state,
              descriptorAudience: catalogEntry.descriptorAudience,
            }
          );
        }
      };

      await doOperationOnTokenStates();

      const secondRetrievalCatalogEntry = await readCatalogEntry(
        pkCatalogEntry,
        dynamoDBClient
      );
      if (!secondRetrievalCatalogEntry) {
        throw genericInternalError("Catalog entry not found");
      }
      if (secondRetrievalCatalogEntry.state !== catalogEntry.state) {
        await doOperationOnTokenStates();
      }
    })
    .with({ type: "AgreementArchivedByUpgrade" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const pk = makePlatformStatesAgreementPK(agreement.id);
      await deleteAgreementEntry(pk, dynamoDBClient);
    })
    .with({ type: "AgreementArchivedByConsumer" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      const primaryKey = makePlatformStatesAgreementPK(agreement.id);
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      if (
        await isAgreementTheLatest(
          GSIPK_consumerId_eserviceId,
          agreement.id,
          dynamoDBClient
        )
      ) {
        // token-generation-states only if agreement is the latest

        await updateAgreementStateInTokenGenerationStatesTable(
          GSIPK_consumerId_eserviceId,
          agreement.state,
          dynamoDBClient
        );
      }

      await deleteAgreementEntry(primaryKey, dynamoDBClient);
    })
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementDeleted" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementRejected" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      () => Promise.resolve()
    )
    .exhaustive();
}

const parseAgreement = (agreementV2: AgreementV2 | undefined): Agreement => {
  if (!agreementV2) {
    throw genericInternalError(`Agreement not found in message data`);
  }

  return fromAgreementV2(agreementV2);
};
