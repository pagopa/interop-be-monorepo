import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  agreementState,
  AgreementV2,
  fromAgreementV2,
  genericInternalError,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  PlatformStatesAgreementEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  agreementStateToItemState,
  deleteAgreementEntry,
  readAgreementEntry,
  updateAgreementStateInPlatformStatesEntry,
  updateAgreementStateOnTokenGenStates,
  writeAgreementEntry,
  isLatestAgreement,
  updateLatestAgreementOnTokenGenStates,
  extractAgreementTimestamp,
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
          logger.info(
            `Skipping processing of entry ${existingAgreementEntry}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version,
            logger
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

        await writeAgreementEntry(agreementEntry, dynamoDBClient, logger);
      }

      await updateLatestAgreementOnTokenGenStates(
        dynamoDBClient,
        agreement,
        logger
      );
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

        const agreementTimestamp = extractAgreementTimestamp(agreement);

        if (!agreementEntry || agreementEntry.version > msg.version) {
          logger.info(
            `Skipping processing of entry ${primaryKey}. Reason: ${
              !agreementEntry
                ? "entry not found in platform-states"
                : "a more recent entry already exists"
            }`
          );
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version,
            logger
          );

          const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          });

          if (
            await isLatestAgreement(
              GSIPK_consumerId_eserviceId,
              agreement.id,
              agreementTimestamp,
              dynamoDBClient
            )
          ) {
            // token-generation-states only if agreement is the latest
            await updateAgreementStateOnTokenGenStates({
              GSIPK_consumerId_eserviceId,
              agreementState: agreement.state,
              dynamoDBClient,
              logger,
            });
          } else {
            logger.info(
              `Token-generation-states. Skipping processing of entry GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}. Reason: agreement is not the latest`
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

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      if (agreementEntry) {
        if (agreementEntry.version > msg.version) {
          logger.info(
            `Skipping processing of entry ${agreementEntry.PK}. Reason: a more recent entry already exists`
          );
          return Promise.resolve();
        } else if (
          agreement.state !== agreementState.active &&
          agreement.state !== agreementState.suspended
        ) {
          logger.info(
            `Skipping processing of entry ${agreementEntry.PK}. Reason: the agreement state ${agreement.state} is not active or suspended`
          );
          return Promise.resolve();
        } else {
          await updateAgreementStateInPlatformStatesEntry(
            dynamoDBClient,
            primaryKey,
            agreementStateToItemState(agreement.state),
            msg.version,
            logger
          );
        }
      } else {
        if (!agreement.stamps.upgrade) {
          throw genericInternalError(
            "An upgraded agreement should have an upgrade stamp"
          );
        }
        const newAgreementEntry: PlatformStatesAgreementEntry = {
          PK: primaryKey,
          state: agreementStateToItemState(agreement.state),
          version: msg.version,
          updatedAt: new Date().toISOString(),
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp: agreement.stamps.upgrade.when.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

        await writeAgreementEntry(newAgreementEntry, dynamoDBClient, logger);
      }

      await updateLatestAgreementOnTokenGenStates(
        dynamoDBClient,
        agreement,
        logger
      );
    })
    .with({ type: "AgreementArchivedByUpgrade" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      const pk = makePlatformStatesAgreementPK(agreement.id);
      await deleteAgreementEntry(pk, dynamoDBClient, logger);
    })
    .with({ type: "AgreementArchivedByConsumer" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      const primaryKey = makePlatformStatesAgreementPK(agreement.id);
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      const agreementTimestamp = extractAgreementTimestamp(agreement);

      if (
        await isLatestAgreement(
          GSIPK_consumerId_eserviceId,
          agreement.id,
          agreementTimestamp,
          dynamoDBClient
        )
      ) {
        // token-generation-states only if agreement is the latest
        await updateAgreementStateOnTokenGenStates({
          GSIPK_consumerId_eserviceId,
          agreementState: agreement.state,
          dynamoDBClient,
          logger,
        });
      } else {
        logger.info(
          `Token-generation-states. Skipping processing of entry GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId}. Reason: agreement is not the latest`
        );
      }

      await deleteAgreementEntry(primaryKey, dynamoDBClient, logger);
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
