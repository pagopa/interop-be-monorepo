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
  ListResult,
  WithMetadata,
  agreementState,
  agreementEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { AgreementProcessConfig } from "../utilities/config.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import { eServiceNotFound, tenantIdNotFound } from "../model/domain/errors.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementContractAdded,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementUpdated,
} from "../model/domain/toEvent.js";

import {
  ApiAgreementDocumentSeed,
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import {
  assertAgreementExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifyCreationConflictingAgreements,
} from "./validators.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { constractBuilder } from "./agreementContractBuilder.js";
import { AgreementQueryFilters } from "./readmodel/readModelService.js";

const fileManager = initFileManager(config);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  config: AgreementProcessConfig,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery
) {
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
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await agreementQuery.listAgreements(filters, limit, offset);
    },
    async getAgreementById(
      agreementId: string
    ): Promise<Agreement | undefined> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await agreementQuery.getAgreementById(agreementId);
      return agreement?.data;
    },
    async createAgreement(
      agreement: ApiAgreementPayload,
      authData: AuthData
    ): Promise<string> {
      const createAgreementEvent = await createAgreementLogic(
        agreement,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery
      );
      return await repository.createEvent(createAgreementEvent);
    },
    async updateAgreement(
      agreementId: string,
      agreement: ApiAgreementUpdatePayload,
      authData: AuthData
    ): Promise<void> {
      const agreementToBeUpdated = await agreementQuery.getAgreementById(
        agreementId
      );

      await repository.createEvent(
        await updateAgreementLogic({
          agreementId,
          agreement,
          authData,
          agreementToBeUpdated,
        })
      );
    },
    async deleteAgreementById(
      agreementId: string,
      authData: AuthData
    ): Promise<void> {
      const agreement = await agreementQuery.getAgreementById(agreementId);

      await repository.createEvent(
        await deleteAgreementLogic({
          agreementId,
          authData,
          deleteFile: fileManager.deleteFile,
          agreement,
        })
      );
    },
    async addAgreementContract(
      agreementId: string,
      seed: ApiAgreementDocumentSeed
    ): Promise<void> {
      const addAgreementcontract = await addAgreementContractLogic(
        agreementId,
        seed
      );
      await repository.createEvent(addAgreementcontract);
    },
    async submitAgreement(
      agreementId: string,
      payload: ApiAgreementSubmissionPayload
    ): Promise<string> {
      logger.info("Submitting agreement");
      const updateResults = await submitAgreementLogic(
        agreementId,
        payload,
        constractBuilder,
        eserviceQuery,
        agreementQuery,
        tenantQuery,
        this.addAgreementContract
      );

      await Promise.all(
        updateResults.events.map((e) => repository.createEvent(e))
      );

      return updateResults.updatedAgreement.id;
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

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
  agreement: ApiAgreementPayload,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(
    `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
  );
  const eservice = await eserviceQuery.getEServiceById(agreement.eserviceId);

  if (!eservice) {
    throw eServiceNotFound(400, agreement.eserviceId);
  }

  const descriptor = validateCreationOnDescriptor(
    eservice.data,
    agreement.descriptorId
  );

  await verifyCreationConflictingAgreements(
    agreementQuery,
    authData.organizationId,
    agreement
  );
  const consumer = await tenantQuery.getTenantById(authData.organizationId);

  if (!consumer) {
    throw tenantIdNotFound(404, authData.organizationId);
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

export async function addAgreementContractLogic(
  agreementId: string,
  seed: ApiAgreementDocumentSeed
): Promise<CreateEvent<AgreementEvent>> {
  logger.info(`Adding contract ${seed.id} to Agreement ${agreementId}`);

  return toCreateEventAgreementContractAdded(
    agreementId,
    apiAgreementDocumentToAgreementDocument(seed)
  );
}
