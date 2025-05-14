import { match } from "ts-pattern";
import {
  Agreement,
  AgreementEventEnvelopeV1,
  AgreementV1,
  genericInternalError,
  fromAgreementV1,
  makePlatformStatesAgreementPK,
  PlatformStatesAgreementEntry,
  agreementState,
  makeGSIPKConsumerIdEServiceId,
  unsafeBrandId,
  AgreementId,
  itemState,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  readAgreementEntry,
  agreementStateToItemState,
  updateAgreementStateOnTokenGenStates,
  isLatestAgreement,
  updateLatestAgreementOnTokenGenStates,
  extractAgreementTimestamp,
  upsertPlatformStatesAgreementEntry,
  updateAgreementStateInPlatformStatesV1,
  updateAgreementStateInTokenGenStatesV1,
  updateAgreementStateInPlatformStatesEntry,
} from "./utils.js";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with(
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      async (msg) => {
        const agreement = parseAgreement(msg.data.agreement);
        await handleActivationOrSuspension(
          agreement,
          dynamoDBClient,
          msg.version,
          logger
        );
      }
    )
    .with({ type: "AgreementUpdated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        .with(agreementState.active, agreementState.suspended, async () => {
          await handleActivationOrSuspension(
            agreement,
            dynamoDBClient,
            msg.version,
            logger
          );
        })
        .with(agreementState.archived, async () => {
          await handleArchiving(agreement, dynamoDBClient, msg.version, logger);
        })
        .with(
          agreementState.draft,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          () => {
            logger.info(
              `Skipping processing of agreement ${agreement.id}. Reason: state ${agreement.state}`
            );
            return Promise.resolve();
          }
        )
        .exhaustive();
    })
    .with({ type: "AgreementAdded" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        .with(agreementState.active, agreementState.suspended, async () => {
          // this case is for agreement upgraded
          await handleUpgrade(agreement, dynamoDBClient, msg.version, logger);
        })
        .with(
          agreementState.draft,
          agreementState.archived,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          // eslint-disable-next-line sonarjs/no-identical-functions
          () => {
            logger.info(
              `Skipping processing of agreement ${agreement.id}. Reason: state ${agreement.state}`
            );
            return Promise.resolve();
          }
        )
        .exhaustive();
    })
    .with({ type: "AgreementDeactivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      await handleArchiving(agreement, dynamoDBClient, msg.version, logger);
    })
    .with({ type: "AgreementDeleted" }, async (msg) => {
      const agreementId = unsafeBrandId<AgreementId>(msg.data.agreementId);
      await updateAgreementStateInPlatformStatesV1(
        agreementId,
        itemState.inactive,
        msg.version,
        dynamoDBClient,
        logger
      );

      await updateAgreementStateInTokenGenStatesV1(
        agreementId,
        itemState.inactive,
        dynamoDBClient,
        logger
      );
    })
    .with(
      { type: "VerifiedAttributeUpdated" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementContractAdded" },
      async () => Promise.resolve()
    )
    .exhaustive();
}

const parseAgreement = (agreementV1: AgreementV1 | undefined): Agreement => {
  if (!agreementV1) {
    throw genericInternalError(`Agreement not found in message data`);
  }

  return fromAgreementV1(agreementV1);
};

const handleActivationOrSuspension = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  incomingVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const existingAgreementEntry = await readAgreementEntry(
    primaryKey,
    dynamoDBClient
  );

  const agreementTimestamp = extractAgreementTimestamp(agreement);
  if (agreement.stamps.activation === undefined) {
    logger.warn(
      `Missing agreement activation stamp for agreement with id ${agreement.id}. Using createdAt as fallback.`
    );
  }

  if (isLatestAgreement(existingAgreementEntry, agreementTimestamp)) {
    if (
      existingAgreementEntry &&
      existingAgreementEntry.version > incomingVersion &&
      existingAgreementEntry.agreementId === agreement.id
    ) {
      logger.info(
        `Skipping processing of entry ${primaryKey}. Reason: a more recent entry already exists`
      );
      return Promise.resolve();
    } else {
      const agreementEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: agreementStateToItemState(agreement.state),
        version: incomingVersion,
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp,
        agreementDescriptorId: agreement.descriptorId,
      };

      await upsertPlatformStatesAgreementEntry(
        agreementEntry,
        dynamoDBClient,
        logger
      );
    }

    // token-generation-states
    /* 
    In consumerServiceV2, the handler for activation and suspension doesn't have to update 
    the descriptor info in the token-generation-states. Here it's needed because this handler also 
    includes the agreement upgrade (which requires updating descriptor info).
    */
    await updateLatestAgreementOnTokenGenStates(
      dynamoDBClient,
      agreement,
      logger
    );
  } else {
    logger.info(
      `Platform-states and token-generation-states. Skipping processing of entry with agreementId ${agreement.id}. Reason: agreement is not the latest`
    );
    return Promise.resolve();
  }
};

const handleArchiving = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  msgVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });
  const agreementEntry = await readAgreementEntry(primaryKey, dynamoDBClient);

  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const agreementTimestamp = extractAgreementTimestamp(agreement);

  if (
    isLatestAgreement(agreementEntry, agreementTimestamp) &&
    agreementEntry?.agreementId === agreement.id
  ) {
    // token-generation-states only if agreement is the latest
    await updateAgreementStateOnTokenGenStates({
      GSIPK_consumerId_eserviceId,
      agreementState: agreement.state,
      dynamoDBClient,
      logger,
    });

    await updateAgreementStateInPlatformStatesEntry(
      dynamoDBClient,
      primaryKey,
      agreementStateToItemState(agreement.state),
      msgVersion,
      logger
    );
  } else {
    logger.info(
      `Token-generation-states. Skipping processing of entry with GSIPK_consumerId_eserviceId ${GSIPK_consumerId_eserviceId} and agreement ${agreement.id}. Reason: agreement is not the latest`
    );
  }
};

const handleUpgrade = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  msgVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });
  const agreementEntry = await readAgreementEntry(primaryKey, dynamoDBClient);

  const agreementTimestamp = extractAgreementTimestamp(agreement);
  if (agreement.stamps.upgrade === undefined) {
    logger.warn(
      `Missing agreement upgrade stamp for agreement with id ${agreement.id}. Using activation stamp or createdAt as fallback.`
    );
  }

  if (isLatestAgreement(agreementEntry, agreementTimestamp)) {
    if (
      agreementEntry &&
      agreementEntry.version > msgVersion &&
      agreementEntry.agreementId === agreement.id
    ) {
      logger.info(
        `Skipping processing of entry ${agreementEntry}. Reason: a more recent entry already exists`
      );
      return Promise.resolve();
    } else {
      const newAgreementEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: agreementStateToItemState(agreement.state),
        version: msgVersion,
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp,
        agreementDescriptorId: agreement.descriptorId,
      };

      await upsertPlatformStatesAgreementEntry(
        newAgreementEntry,
        dynamoDBClient,
        logger
      );
    }

    await updateLatestAgreementOnTokenGenStates(
      dynamoDBClient,
      agreement,
      logger
    );
  } else {
    logger.info(
      `Platform-states and token-generation-states. Skipping processing of entry with agreementId ${agreement.id}. Reason: agreement is not the latest`
    );
    return Promise.resolve();
  }
};
