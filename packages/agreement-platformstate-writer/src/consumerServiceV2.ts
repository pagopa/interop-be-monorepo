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
  PlatformStatesCatalogEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  agreementStateToItemState,
  deleteAgreementEntry,
  readAgreementEntry,
  readCatalogEntry,
  updateAgreementStateInPlatformStatesEntry,
  updateAgreementStateOnTokenStates,
  updateAgreementStateAndDescriptorInfoOnTokenStates,
  writeAgreementEntry,
  isLatestAgreement,
} from "./utils.js";

export async function handleMessageV2(
  message: AgreementEventEnvelopeV2,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
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

      if (existingAgreementEntry) {
        if (existingAgreementEntry.version > msg.version) {
          // Stops processing if the message is older than the agreement entry
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version
          );
        }
      } else {
        if (!agreement.stamps.activation) {
          throw genericInternalError(
            "An activated agreement should have activation stamp"
          );
        }
        const agreementEntry: PlatformStatesAgreementEntry = {
          PK: primaryKey,
          state: agreementStateToItemState(agreement.state),
          version: msg.version,
          updatedAt: new Date().toISOString(),
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            agreement.stamps.activation.when.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

        await writeAgreementEntry(agreementEntry, dynamoDBClient);
      }

      if (
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreement.id,
          dynamoDBClient
        )
      ) {
        const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
        });

        const catalogEntry = await readCatalogEntry(
          pkCatalogEntry,
          dynamoDBClient
        );

        const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
        });

        // token-generation-states
        await updateAgreementStateAndDescriptorInfoOnTokenStates({
          GSIPK_consumerId_eserviceId,
          agreementId: agreement.id,
          agreementState: agreement.state,
          dynamoDBClient,
          GSIPK_eserviceId_descriptorId,
          catalogEntry,
          logger,
        });
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
            await isLatestAgreement(
              GSIPK_consumerId_eserviceId,
              agreement.id,
              dynamoDBClient
            )
          ) {
            // token-generation-states only if agreement is the latest

            await updateAgreementStateOnTokenStates({
              GSIPK_consumerId_eserviceId,
              agreementState: agreement.state,
              dynamoDBClient,
            });
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

      const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      if (agreementEntry) {
        if (agreementEntry.version > msg.version) {
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version
          );
        }
      } else {
        if (!agreement.stamps.activation) {
          throw genericInternalError(
            "An activated agreement should have activation stamp"
          );
        }
        const newAgreementEntry: PlatformStatesAgreementEntry = {
          PK: primaryKey,
          state: agreementStateToItemState(agreement.state),
          version: msg.version,
          updatedAt: new Date().toISOString(),
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            agreement.stamps.activation.when.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

        await writeAgreementEntry(newAgreementEntry, dynamoDBClient);
      }

      const updateLatestAgreementOnTokenStates = async (
        catalogEntry: PlatformStatesCatalogEntry | undefined
      ): Promise<void> => {
        if (
          await isLatestAgreement(
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

          await updateAgreementStateAndDescriptorInfoOnTokenStates({
            GSIPK_consumerId_eserviceId,
            agreementId: agreement.id,
            agreementState: agreement.state,
            dynamoDBClient,
            GSIPK_eserviceId_descriptorId,
            catalogEntry,
            logger,
          });
        }
      };

      logger.info(
        `Retrieving catalog entry ${pkCatalogEntry} to add descriptor info in token-generation-states`
      );

      const catalogEntry = await readCatalogEntry(
        pkCatalogEntry,
        dynamoDBClient
      );

      await updateLatestAgreementOnTokenStates(catalogEntry);

      const updatedCatalogEntry = await readCatalogEntry(
        pkCatalogEntry,
        dynamoDBClient
      );

      if (
        updatedCatalogEntry &&
        (!catalogEntry || updatedCatalogEntry.state !== catalogEntry.state)
      ) {
        await updateLatestAgreementOnTokenStates(updatedCatalogEntry);
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
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreement.id,
          dynamoDBClient
        )
      ) {
        // token-generation-states only if agreement is the latest

        await updateAgreementStateOnTokenStates({
          GSIPK_consumerId_eserviceId,
          agreementState: agreement.state,
          dynamoDBClient,
        });
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
