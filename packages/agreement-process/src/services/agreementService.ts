import { z } from "zod";
import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  ListResult,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  AgreementStamp,
  agreementUpgradableStates,
  agreementDeletableStates,
  agreementUpdatableStates,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { utcToZonedTime } from "date-fns-tz";
import {
  descriptorNotFound,
  noNewerDescriptor,
  unexpectedVersionFormat,
} from "../model/domain/errors.js";
import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementUpdated,
} from "../model/domain/toEvent.js";
import { publishedDescriptorNotFound } from "../model/domain/errors.js";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertTenantExist,
  declaredAttributesSatisfied,
  validateCertifiedAttributes,
  validateCreationOnDescriptor,
  verifiedAttributesSatisfied,
  verifyConflictingAgreements,
  verifyCreationConflictingAgreements,
} from "../model/domain/validators.js";
import { CompactOrganization } from "../model/domain/models.js";
import {
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { AgreementQueryFilters } from "./readmodel/readModelService.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

const fileManager = initFileManager(config);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery,
  attributeQuery: AttributeQuery
) {
  const repository = eventRepository(dbInstance, agreementEventToBinaryData);
  return {
    async getAgreements(
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      logger.info("Retrieving agreements");
      return await agreementQuery.getAgreements(filters, limit, offset);
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
    async getAgreementProducers(
      producerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${producerName}`
      );
      return await agreementQuery.getProducers(producerName, limit, offset);
    },
    async getAgreementConsumers(
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      logger.info(
        `Retrieving consumers from agreements with consumer name ${consumerName}`
      );
      return await agreementQuery.getConsumers(consumerName, limit, offset);
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
    async submitAgreement(
      agreementId: string,
      payload: ApiAgreementSubmissionPayload
    ): Promise<string> {
      logger.info("Submitting agreement");
      const updatesEvents = await submitAgreementLogic(
        agreementId,
        payload,
        contractBuilder(attributeQuery),
        eserviceQuery,
        agreementQuery,
        tenantQuery
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }

      return agreementId;
    },
    async upgradeAgreement(
      agreementId: string,
      authData: AuthData
    ): Promise<string> {
      logger.info("Upgrading agreement");
      const { streamId, events } = await upgradeAgreementLogic({
        agreementId,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        fileCopy: fileManager.copy,
      });

      for (const event of events) {
        await repository.createEvent(event);
      }

      return streamId;
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

async function createAndCopyDocumentsForClonedAgreement(
  newAgreementId: string,
  clonedAgreement: Agreement,
  startingVersion: number,
  fileCopy: (
    container: string,
    sourcePath: string,
    destinationPath: string,
    destinationFileName: string,
    docName: string
  ) => Promise<string>
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const docs = await Promise.all(
    clonedAgreement.consumerDocuments.map(async (d) => {
      const newId = uuidv4();
      return {
        newId,
        newPath: await fileCopy(
          config.storageContainer,
          `${config.consumerDocumentsPath}/${newAgreementId}`,
          d.path,
          newId,
          d.name
        ),
      };
    })
  );
  return docs.map((d, i) =>
    toCreateEventAgreementConsumerDocumentAdded(
      newAgreementId,
      {
        id: d.newId,
        name: clonedAgreement.consumerDocuments[i].name,
        prettyName: clonedAgreement.consumerDocuments[i].prettyName,
        contentType: clonedAgreement.consumerDocuments[i].contentType,
        path: d.newPath,
        createdAt: utcToZonedTime(new Date(), "ETC/UTC"),
      },
      startingVersion + i
    )
  );
}

export async function deleteAgreementLogic({
  agreementId,
  authData,
  deleteFile,
  agreement,
}: {
  agreementId: string;
  authData: AuthData;
  deleteFile: (container: string, path: string) => Promise<void>;
  agreement: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data.consumerId, authData.organizationId);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementDeletableStates
  );

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(config.storageContainer, d.path);
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
  assertEServiceExist(agreement.eserviceId, eservice);

  const descriptor = validateCreationOnDescriptor(
    eservice.data,
    agreement.descriptorId
  );

  await verifyCreationConflictingAgreements(
    authData.organizationId,
    agreement,
    agreementQuery
  );
  const consumer = await tenantQuery.getTenantById(authData.organizationId);
  assertTenantExist(authData.organizationId, consumer);

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

  assertExpectedState(
    agreementId,
    agreementToBeUpdated.data.state,
    agreementUpdatableStates
  );

  const agreementUpdated: Agreement = {
    ...agreementToBeUpdated.data,
    consumerNotes: agreement.consumerNotes,
  };

  return toCreateEventAgreementUpdated(
    agreementUpdated,
    agreementToBeUpdated.metadata.version
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function upgradeAgreementLogic({
  agreementId,
  authData,
  agreementQuery,
  eserviceQuery,
  tenantQuery,
  fileCopy,
}: {
  agreementId: string;
  authData: AuthData;
  agreementQuery: AgreementQuery;
  eserviceQuery: EserviceQuery;
  tenantQuery: TenantQuery;
  fileCopy: (
    container: string,
    sourcePath: string,
    destinationPath: string,
    destinationFileName: string,
    docName: string
  ) => Promise<string>;
}): Promise<{ streamId: string; events: Array<CreateEvent<AgreementEvent>> }> {
  const agreementToBeUpgraded = await agreementQuery.getAgreementById(
    agreementId
  );
  const tenant = await tenantQuery.getTenantById(authData.organizationId);
  assertTenantExist(authData.organizationId, tenant);
  assertAgreementExist(agreementId, agreementToBeUpgraded);
  assertRequesterIsConsumer(
    agreementToBeUpgraded.data.consumerId,
    authData.organizationId
  );

  assertExpectedState(
    agreementId,
    agreementToBeUpgraded.data.state,
    agreementUpgradableStates
  );

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeUpgraded.data.eserviceId
  );
  assertEServiceExist(agreementToBeUpgraded.data.eserviceId, eservice);

  const newDescriptor = eservice.data.descriptors.find(
    (d) => d.state === descriptorState.published
  );
  if (newDescriptor === undefined) {
    throw publishedDescriptorNotFound(agreementToBeUpgraded.data.eserviceId);
  }
  const latestDescriptorVersion = z
    .preprocess((x) => Number(x), z.number())
    .safeParse(newDescriptor.version);
  if (!latestDescriptorVersion.success) {
    throw unexpectedVersionFormat(eservice.data.id, newDescriptor.id);
  }

  const currentDescriptor = eservice.data.descriptors.find(
    (d) => d.id === agreementToBeUpgraded.data.descriptorId
  );
  if (currentDescriptor === undefined) {
    throw descriptorNotFound(
      eservice.data.id,
      agreementToBeUpgraded.data.descriptorId
    );
  }

  const currentVersion = z
    .preprocess((x) => Number(x), z.number())
    .safeParse(currentDescriptor.version);
  if (!currentVersion.success) {
    throw unexpectedVersionFormat(eservice.data.id, currentDescriptor.id);
  }

  if (latestDescriptorVersion.data <= currentVersion.data) {
    throw noNewerDescriptor(eservice.data.id, currentDescriptor.id);
  }

  if (eservice.data.producerId !== authData.organizationId) {
    validateCertifiedAttributes(newDescriptor, tenant.data);
  }

  const verifiedValid = verifiedAttributesSatisfied(
    agreementToBeUpgraded.data.producerId,
    newDescriptor,
    tenant.data
  );

  const declaredValid = declaredAttributesSatisfied(newDescriptor, tenant.data);

  if (verifiedValid && declaredValid) {
    // upgradeAgreement
    const stamp: AgreementStamp = {
      who: authData.organizationId,
      when: new Date(),
    };
    const archived: Agreement = {
      ...agreementToBeUpgraded.data,
      state: agreementState.archived,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        archiving: stamp,
      },
    };
    const upgraded: Agreement = {
      ...agreementToBeUpgraded.data,
      id: uuidv4(),
      descriptorId: newDescriptor.id,
      createdAt: new Date(),
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreementToBeUpgraded.data.stamps,
        upgrade: stamp,
      },
    };

    return {
      streamId: upgraded.id,
      events: [
        toCreateEventAgreementUpdated(
          archived,
          agreementToBeUpgraded.metadata.version
        ),
        toCreateEventAgreementAdded(upgraded),
      ],
    };
  } else {
    // createNewDraftAgreement
    await verifyConflictingAgreements(
      agreementToBeUpgraded.data.consumerId,
      agreementToBeUpgraded.data.eserviceId,
      [agreementState.draft],
      agreementQuery
    );
    const createEvent = await createAgreementLogic(
      {
        eserviceId: agreementToBeUpgraded.data.eserviceId,
        descriptorId: newDescriptor.id,
      },
      authData,
      agreementQuery,
      eserviceQuery,
      tenantQuery
    );

    const docEvents = await createAndCopyDocumentsForClonedAgreement(
      createEvent.streamId,
      agreementToBeUpgraded.data,
      1,
      fileCopy
    );

    return {
      streamId: createEvent.streamId,
      events: [createEvent, ...docEvents],
    };
  }
}
