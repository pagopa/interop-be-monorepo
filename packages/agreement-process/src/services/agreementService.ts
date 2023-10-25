import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  PersistentAgreement,
  PersistentAgreementState,
  WithMetadata,
  agreementEventToBinaryData,
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
  persistentAgreementState,
} from "pagopa-interop-models";
import { config } from "../utilities/config.js";
import { toCreateEventAgreementDeleted } from "../model/domain/toEvent.js";
import { readModelService } from "./readModelService.js";

const fileManager = initFileManager(config);

const repository = eventRepository(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  agreementEventToBinaryData
);

function assertAgreementExist(
  agreementId: string,
  agreement: WithMetadata<PersistentAgreement> | undefined
): asserts agreement is NonNullable<WithMetadata<PersistentAgreement>> {
  if (agreement === undefined) {
    throw agreementNotFound(agreementId);
  }
}

const assertRequesterIsConsumer = (
  consumerId: string,
  requesterId: string
): void => {
  if (consumerId !== requesterId) {
    throw operationNotAllowed(requesterId);
  }
};

export const agreementService = {
  async getAgreementById(
    agreementId: string
  ): Promise<PersistentAgreement | undefined> {
    logger.info(`Retrieving agreement by id ${agreementId}`);

    const agreement = await readModelService.readAgreementById(agreementId);
    return agreement?.data;
  },
  async deleteAgreementById(
    agreementId: string,
    authData: AuthData
  ): Promise<void> {
    const agreement = await readModelService.readAgreementById(agreementId);

    await repository.createEvent(
      await deleteAgreementLogic({
        agreementId,
        authData,
        deleteFile: fileManager.deleteFile,
        agreement,
      })
    );
  },
};

export async function deleteAgreementLogic({
  agreementId,
  authData,
  deleteFile,
  agreement,
}: {
  agreementId: string;
  authData: AuthData;
  deleteFile: (path: string) => Promise<void>;
  agreement: WithMetadata<PersistentAgreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data.consumerId, authData.organizationId);

  const deletableStates: PersistentAgreementState[] = [
    persistentAgreementState.draft,
    persistentAgreementState.missingCertifiedAttributes,
  ];

  if (!deletableStates.includes(agreement.data.state)) {
    throw agreementNotInExpectedState(agreementId, agreement.data.state);
  }

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(d.path);
  }

  return toCreateEventAgreementDeleted(agreementId, agreement.metadata.version);
}
