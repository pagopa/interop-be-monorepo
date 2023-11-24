import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementState,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  ListResult,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { AgreementProcessConfig, config } from "../utilities/config.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementUpdated,
} from "../model/domain/toEvent.js";
import { eServiceNotFound, tenantIdNotFound } from "../model/domain/errors.js";
import {
  ApiAgreementPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { ReadModelService } from "./readModelService.js";

import {
  assertAgreementExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifyCreationConflictingAgreements,
} from "./validators.js";

const fileManager = initFileManager(config);

export class AgreementService {
  private readModelService: ReadModelService;
  private repository;

  constructor(
    readModelService: ReadModelService,
    config: AgreementProcessConfig
  ) {
    this.readModelService = readModelService;
    this.repository = eventRepository(
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
  }

  public async getAgreements(
    filters: {
      eServicesIds: string[];
      consumersIds: string[];
      producersIds: string[];
      descriptorsIds: string[];
      states: AgreementState[];
      showOnlyUpgradeable: boolean;
    },
    limit: number,
    offset: number
  ): Promise<ListResult<Agreement>> {
    logger.info("Retrieving agreements");
    return await this.readModelService.listAgreements(filters, limit, offset);
  }

  public async getAgreementById(
    agreementId: string
  ): Promise<Agreement | undefined> {
    logger.info(`Retrieving agreement by id ${agreementId}`);

    const agreement = await this.readModelService.readAgreementById(
      agreementId
    );
    return agreement?.data;
  }

  public async createAgreement(
    agreement: ApiAgreementPayload,
    authData: AuthData
  ): Promise<string> {
    const createAgreementEvent = await createAgreementLogic(
      this.readModelService,
      agreement,
      authData
    );
    return await this.repository.createEvent(createAgreementEvent);
  }

  public async updateAgreement(
    agreementId: string,
    agreement: ApiAgreementUpdatePayload,
    authData: AuthData
  ): Promise<void> {
    const agreementToBeUpdated = await this.readModelService.readAgreementById(
      agreementId
    );

    await this.repository.createEvent(
      await updateAgreementLogic({
        agreementId,
        agreement,
        authData,
        agreementToBeUpdated,
      })
    );
  }

  public async deleteAgreementById(
    agreementId: string,
    authData: AuthData
  ): Promise<void> {
    const agreement = await this.readModelService.readAgreementById(
      agreementId
    );

    await this.repository.createEvent(
      await deleteAgreementLogic({
        agreementId,
        authData,
        deleteFile: fileManager.deleteFile,
        agreement,
      })
    );
  }
}

export async function deleteAgreementLogic({
  agreementId,
  authData,
  deleteFile,
  agreement,
}: {
  agreementId: string;
  authData: AuthData;
  deleteFile: (path: string) => Promise<void>;
  agreement: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data.consumerId, authData.organizationId);

  const deletableStates: AgreementState[] = [
    agreementState.draft,
    agreementState.missingCertifiedAttributes,
  ];

  assertExpectedState(agreementId, agreement.data.state, deletableStates);

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(d.path);
  }

  return toCreateEventAgreementDeleted(agreementId, agreement.metadata.version);
}

export async function createAgreementLogic(
  readModelService: ReadModelService,
  agreement: ApiAgreementPayload,
  authData: AuthData
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
  );
  const eservice = await readModelService.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(400, agreement.eserviceId);
  }

  const descriptor = validateCreationOnDescriptor(
    eservice.data,
    agreement.descriptorId
  );

  await verifyCreationConflictingAgreements(
    readModelService,
    authData.organizationId,
    agreement
  );
  const consumer = await readModelService.getTenantById(
    authData.organizationId
  );

  if (!consumer) {
    throw tenantIdNotFound(authData.organizationId);
  }

  if (eservice.data.producerId !== consumer.data.id) {
    validateCertifiedAttributes(descriptor, consumer.data);
  }

  const agreementSeed: Agreement = {
    id: uuidv4(),
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: eservice.data.producerId,
    consumerId: authData.organizationId,
    state: agreementState.draft,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    suspendedByPlatform: undefined,
    consumerDocuments: [],
    createdAt: new Date(),
    updatedAt: undefined,
    consumerNotes: undefined,
    contract: undefined,
    stamps: {
      submission: undefined,
      activation: undefined,
      rejection: undefined,
      suspensionByProducer: undefined,
      suspensionByConsumer: undefined,
      upgrade: undefined,
      archiving: undefined,
    },
    rejectionReason: undefined,
    suspendedAt: undefined,
  };

  return toCreateEventAgreementAdded(agreementSeed);
}

export async function updateAgreementLogic({
  agreementId,
  agreement,
  authData,
  agreementToBeUpdated,
}: {
  agreementId: string;
  agreement: ApiAgreementUpdatePayload;
  authData: AuthData;
  agreementToBeUpdated: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreementToBeUpdated);
  assertRequesterIsConsumer(
    agreementToBeUpdated.data.consumerId,
    authData.organizationId
  );

  const updatableStates: AgreementState[] = [agreementState.draft];

  assertExpectedState(
    agreementId,
    agreementToBeUpdated.data.state,
    updatableStates
  );

  const agreementUpdated: Agreement = {
    ...agreementToBeUpdated.data,
    consumerNotes: agreement.consumerNotes,
  };

  return toCreateEventAgreementUpdated(agreementUpdated);
}
