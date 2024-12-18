import { match } from "ts-pattern";
import {
  Agreement,
  AgreementEventEnvelopeV1,
  AgreementV1,
  genericInternalError,
  fromAgreementV1,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesAgreementEntry,
  agreementState,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
import {
  readAgreementEntry,
  updateAgreementStateInPlatformStatesEntry,
  agreementStateToItemState,
  updateAgreementStateOnTokenGenStates,
  writeAgreementEntry,
  readCatalogEntry,
  updateAgreementStateAndDescriptorInfoOnTokenGenStates,
  deleteAgreementEntry,
  isLatestAgreement,
  updateLatestAgreementOnTokenGenStates,
} from "./utils.js";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<void> {
  await match(message)
    .with({ type: "AgreementActivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      await handleFirstActivation(
        agreement,
        dynamoDBClient,
        msg.version,
        logger
      );
    })
    .with({ type: "AgreementSuspended" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      await handleActivationOrSuspension(
        agreement,
        dynamoDBClient,
        msg.version,
        logger
      );
    })
    .with({ type: "AgreementUpdated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        // eslint-disable-next-line sonarjs/no-identical-functions
        .with(agreementState.active, agreementState.suspended, async () => {
          const agreement = parseAgreement(msg.data.agreement);
          await handleActivationOrSuspension(
            agreement,
            dynamoDBClient,
            msg.version,
            logger
          );
        })
        .with(agreementState.archived, async () => {
          const agreement = parseAgreement(msg.data.agreement);
          await handleArchiving(agreement, dynamoDBClient);
        })
        .with(
          agreementState.draft,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          () => Promise.resolve()
        )
        .exhaustive();
    })
    .with({ type: "AgreementAdded" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);

      await match(agreement.state)
        .with(agreementState.active, async () => {
          // this case is for agreement upgraded
          const agreement = parseAgreement(msg.data.agreement);
          await handleUpgrade(agreement, dynamoDBClient, msg.version, logger);
        })
        .with(
          agreementState.draft,
          agreementState.archived,
          agreementState.missingCertifiedAttributes,
          agreementState.pending,
          agreementState.rejected,
          agreementState.suspended,
          () => Promise.resolve()
        )
        .exhaustive();
    })
    .with({ type: "AgreementDeactivated" }, async (msg) => {
      const agreement = parseAgreement(msg.data.agreement);
      await handleArchiving(agreement, dynamoDBClient);
    })
    .with(
      { type: "AgreementDeleted" },
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

const handleFirstActivation = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  incomingVersion: number,
  logger: Logger
): Promise<void> => {
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
    if (existingAgreementEntry.version > incomingVersion) {
      // Stops processing if the message is older than the agreement entry
      return Promise.resolve();
    } else {
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        agreementStateToItemState(agreement.state),
        incomingVersion
      );
    }
  } else {
    const agreementEntry: PlatformStatesAgreementEntry = {
      PK: primaryKey,
      state: agreementStateToItemState(agreement.state),
      version: incomingVersion,
      updatedAt: new Date().toISOString(),
      GSIPK_consumerId_eserviceId,
      GSISK_agreementTimestamp:
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreement.stamps.activation!.when.toISOString(),
      agreementDescriptorId: agreement.descriptorId,
    };

    await writeAgreementEntry(agreementEntry, dynamoDBClient);
  }

  await updateLatestAgreementOnTokenGenStates(
    dynamoDBClient,
    agreement,
    logger
  );
};

const handleActivationOrSuspension = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  incomingVersion: number,
  logger: Logger
): Promise<void> => {
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
    !existingAgreementEntry ||
    existingAgreementEntry.version > incomingVersion
  ) {
    return Promise.resolve();
  } else {
    await updateAgreementStateInPlatformStatesEntry(
      dynamoDBClient,
      primaryKey,
      agreementStateToItemState(agreement.state),
      incomingVersion
    );

    const pkCatalogEntry = makePlatformStatesEServiceDescriptorPK({
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
    });
    const catalogEntry = await readCatalogEntry(pkCatalogEntry, dynamoDBClient);

    const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
    });

    if (
      await isLatestAgreement(
        GSIPK_consumerId_eserviceId,
        agreement.id,
        dynamoDBClient
      )
    ) {
      // token-generation-states
      /* In consumerServiceV2, the handler for reactivation and suspension doesn't have to update 
      the descriptor info in the token-generation-states. Here is needed because this handler also 
      includes the agreement upgrade (which requires updating descriptor info).
      */
      await updateAgreementStateAndDescriptorInfoOnTokenGenStates({
        GSIPK_consumerId_eserviceId,
        agreementId: agreement.id,
        agreementState: agreement.state,
        dynamoDBClient,
        GSIPK_eserviceId_descriptorId,
        catalogEntry,
        logger,
      });
    }
  }
};

const handleArchiving = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient
): Promise<void> => {
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

    await updateAgreementStateOnTokenGenStates({
      GSIPK_consumerId_eserviceId,
      agreementState: agreement.state,
      dynamoDBClient,
    });
  }

  await deleteAgreementEntry(primaryKey, dynamoDBClient);
};

const handleUpgrade = async (
  agreement: Agreement,
  dynamoDBClient: DynamoDBClient,
  msgVersion: number,
  logger: Logger
): Promise<void> => {
  const primaryKey = makePlatformStatesAgreementPK(agreement.id);
  const agreementEntry = await readAgreementEntry(primaryKey, dynamoDBClient);

  const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  if (agreementEntry) {
    if (agreementEntry.version > msgVersion) {
      return Promise.resolve();
    } else {
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        agreementStateToItemState(agreement.state),
        msgVersion
      );
    }
  } else {
    const newAgreementEntry: PlatformStatesAgreementEntry = {
      PK: primaryKey,
      state: agreementStateToItemState(agreement.state),
      version: msgVersion,
      updatedAt: new Date().toISOString(),
      GSIPK_consumerId_eserviceId,
      GSISK_agreementTimestamp:
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreement.stamps.activation!.when.toISOString(),
      agreementDescriptorId: agreement.descriptorId,
    };

    await writeAgreementEntry(newAgreementEntry, dynamoDBClient);
  }

  await updateLatestAgreementOnTokenGenStates(
    dynamoDBClient,
    agreement,
    logger
  );
};
