import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
  logger,
} from "pagopa-interop-commons";
import {
  AgreementEvent,
  PersistentAgreement,
  PersistentAgreementState,
  WithMetadata,
  agreementEventToBinaryData,
  eServiceCannotBeDeleted,
  eServiceNotFound,
  operationForbidden,
  persistentAgreementState,
} from "pagopa-interop-models";
import { config } from "../utilities/config.js";
import { toCreateEventAgreementDeleted } from "../model/domain/toEvent.js";
import { readModelService } from "./readModelService.js";

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
    throw eServiceNotFound(agreementId);
  }
}

const assertRequesterIsConsumer = (
  consumerId: string,
  requesterId: string
): void => {
  if (consumerId !== requesterId) {
    throw operationForbidden;
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
      deleteAgreementLogic({ agreementId, authData, agreement })
    );
  },
};

export function deleteAgreementLogic({
  agreementId,
  authData,
  agreement,
}: {
  agreementId: string;
  authData: AuthData;
  agreement: WithMetadata<PersistentAgreement> | undefined;
}): CreateEvent<AgreementEvent> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data.consumerId, authData.organizationId);

  const deletableStates: PersistentAgreementState[] = [
    persistentAgreementState.draft,
    persistentAgreementState.missingCertifiedAttributes,
  ];

  if (!deletableStates.includes(agreement.data.state)) {
    throw eServiceCannotBeDeleted(agreementId);
  }

  return toCreateEventAgreementDeleted(agreementId, agreement.metadata.version);
}
