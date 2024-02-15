import { z } from "zod";
import {
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  eventRepository,
  logger,
} from "pagopa-interop-commons";
import {
  generateId,
  Agreement,
  AgreementDocument,
  AgreementEvent,
  ListResult,
  WithMetadata,
  agreementEventToBinaryData,
  agreementState,
  descriptorState,
  AgreementUpdateEvent,
  AgreementDocumentId,
  AgreementId,
} from "pagopa-interop-models";
import {
  agreementAlreadyExists,
  descriptorNotFound,
  noNewerDescriptor,
  unexpectedVersionFormat,
  publishedDescriptorNotFound,
  agreementDocumentNotFound,
} from "../model/domain/errors.js";

import {
  toCreateEventAgreementAdded,
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementDeleted,
  toCreateEventAgreementUpdated,
} from "../model/domain/toEvent.js";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumer,
  assertRequesterIsConsumerOrProducer,
  assertRequesterIsProducer,
  assertTenantExist,
  assertDescriptorExist,
  declaredAttributesSatisfied,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateCertifiedAttributes,
  verifiedAttributesSatisfied,
  verifyConflictingAgreements,
  agreementDeletableStates,
  agreementUpdatableStates,
  agreementUpgradableStates,
  agreementCloningConflictingStates,
  agreementRejectableStates,
} from "../model/domain/validators.js";
import {
  CompactEService,
  CompactOrganization,
} from "../model/domain/models.js";
import {
  ApiAgreementPayload,
  ApiAgreementSubmissionPayload,
  ApiAgreementUpdatePayload,
  ApiAgreementDocumentSeed,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import { AgreementQueryFilters } from "./readmodel/readModelService.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { submitAgreementLogic } from "./agreementSubmissionProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { suspendAgreementLogic } from "./agreementSuspensionProcessor.js";
import { createStamp } from "./agreementStampUtils.js";
import {
  removeAgreementConsumerDocumentLogic,
  addConsumerDocumentLogic,
} from "./agreementConsumerDocumentProcessor.js";
import { activateAgreementLogic } from "./agreementActivationProcessor.js";
import { createAgreementLogic } from "./agreementCreationProcessor.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function agreementServiceBuilder(
  dbInstance: DB,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  eserviceQuery: EserviceQuery,
  attributeQuery: AttributeQuery,
  fileManager: FileManager
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
      agreementId: AgreementId
    ): Promise<Agreement | undefined> {
      logger.info(`Retrieving agreement by id ${agreementId}`);

      const agreement = await agreementQuery.getAgreementById(agreementId);
      return agreement?.data;
    },
    async createAgreement(
      agreement: ApiAgreementPayload,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Creating agreement for EService ${agreement.eserviceId} and Descriptor ${agreement.descriptorId}`
      );
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
      agreementId: AgreementId,
      agreement: ApiAgreementUpdatePayload,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Updating agreement ${agreementId}`);
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
      agreementId: AgreementId,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Deleting agreement ${agreementId}`);
      const agreement = await agreementQuery.getAgreementById(agreementId);

      await repository.createEvent(
        await deleteAgreementLogic({
          agreementId,
          authData,
          deleteFile: fileManager.delete,
          agreement,
        })
      );
    },
    async submitAgreement(
      agreementId: AgreementId,
      payload: ApiAgreementSubmissionPayload
    ): Promise<string> {
      logger.info(`Submitting agreement ${agreementId}`);
      const updatesEvents = await submitAgreementLogic(
        agreementId,
        payload,
        contractBuilder(attributeQuery, fileManager.storeBytes),
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
      agreementId: AgreementId,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Upgrading agreement ${agreementId}`);
      const { streamId, events } = await upgradeAgreementLogic({
        agreementId,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        copyFile: fileManager.copy,
      });

      for (const event of events) {
        await repository.createEvent(event);
      }

      return streamId;
    },
    async cloneAgreement(
      agreementId: AgreementId,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Cloning agreement ${agreementId}`);
      const { streamId, events } = await cloneAgreementLogic({
        agreementId,
        authData,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        copyFile: fileManager.copy,
      });

      for (const event of events) {
        await repository.createEvent(event);
      }

      return streamId;
    },
    async addConsumerDocument(
      agreementId: AgreementId,
      documentSeed: ApiAgreementDocumentSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Adding a consumer document to agreement ${agreementId}`);

      const addDocumentEvent = await addConsumerDocumentLogic(
        agreementId,
        documentSeed,
        agreementQuery,
        authData
      );
      return await repository.createEvent(addDocumentEvent);
    },
    async getAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      authData: AuthData
    ): Promise<AgreementDocument> {
      logger.info(
        `Retrieving consumer document ${documentId} from agreement ${agreementId}`
      );
      const agreement = await agreementQuery.getAgreementById(agreementId);
      assertAgreementExist(agreementId, agreement);
      assertRequesterIsConsumerOrProducer(agreement.data, authData);

      const document = agreement.data.consumerDocuments.find(
        (d) => d.id === documentId
      );

      if (!document) {
        throw agreementDocumentNotFound(documentId, agreementId);
      }

      return document;
    },
    async suspendAgreement(
      agreementId: AgreementId,
      authData: AuthData
    ): Promise<AgreementId> {
      logger.info(`Suspending agreement ${agreementId}`);
      await repository.createEvent(
        await suspendAgreementLogic({
          agreementId,
          authData,
          agreementQuery,
          tenantQuery,
          eserviceQuery,
        })
      );

      return agreementId;
    },
    async getAgreementEServices(
      eServiceName: string | undefined,
      consumerIds: string[],
      producerIds: string[],
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      logger.info(
        `Retrieving EServices with consumers ${consumerIds}, producers ${producerIds}`
      );

      return await agreementQuery.getEServices(
        eServiceName,
        consumerIds,
        producerIds,
        limit,
        offset
      );
    },
    async removeAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Removing consumer document ${documentId} from agreement ${agreementId}`
      );

      const removeDocumentEvent = await removeAgreementConsumerDocumentLogic(
        agreementId,
        documentId,
        agreementQuery,
        authData,
        fileManager.delete
      );

      return await repository.createEvent(removeDocumentEvent);
    },
    async rejectAgreement(
      agreementId: AgreementId,
      rejectionReason: string,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Rejecting agreement ${agreementId}`);
      await repository.createEvent(
        await rejectAgreementLogic({
          agreementId,
          rejectionReason,
          authData,
          agreementQuery,
          tenantQuery,
          eserviceQuery,
        })
      );
      return agreementId;
    },
    async activateAgreement(
      agreementId: Agreement["id"],
      authData: AuthData
    ): Promise<Agreement["id"]> {
      logger.info(`Activating agreement ${agreementId}`);
      const updatesEvents = await activateAgreementLogic(
        agreementId,
        agreementQuery,
        eserviceQuery,
        tenantQuery,
        attributeQuery,
        authData,
        fileManager.storeBytes
      );

      for (const event of updatesEvents) {
        await repository.createEvent(event);
      }
      return agreementId;
    },
    async archiveAgreement(
      agreementId: AgreementId,
      authData: AuthData
    ): Promise<Agreement["id"]> {
      logger.info(`Archiving agreement ${agreementId}`);

      await repository.createEvent(
        await archiveAgreementLogic(agreementId, authData, agreementQuery)
      );

      return agreementId;
    },
  };
}

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

async function createAndCopyDocumentsForClonedAgreement(
  newAgreementId: AgreementId,
  clonedAgreement: Agreement,
  startingVersion: number,
  copyFile: (
    bucket: string,
    sourcePath: string,
    destinationPath: string,
    destinationFileName: string,
    docName: string
  ) => Promise<string>
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const docs = await Promise.all(
    clonedAgreement.consumerDocuments.map(async (d) => {
      const newId: AgreementDocumentId = generateId();
      return {
        newId,
        newPath: await copyFile(
          config.s3Bucket,
          `${config.consumerDocumentsPath}/${newAgreementId}`,
          d.path,
          newId,
          d.name
        ),
      };
    })
  ).catch((error) => {
    logger.error(
      `Error copying documents' files for agreement ${clonedAgreement.id} : ${error}`
    );
  });

  return (docs ?? []).map((d, i) =>
    toCreateEventAgreementConsumerDocumentAdded(
      newAgreementId,
      {
        id: d.newId,
        name: clonedAgreement.consumerDocuments[i].name,
        prettyName: clonedAgreement.consumerDocuments[i].prettyName,
        contentType: clonedAgreement.consumerDocuments[i].contentType,
        path: d.newPath,
        createdAt: new Date(),
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
  agreementId: AgreementId;
  authData: AuthData;
  deleteFile: (bucket: string, path: string) => Promise<void>;
  agreement: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementDeletableStates
  );

  for (const d of agreement.data.consumerDocuments) {
    await deleteFile(config.s3Bucket, d.path).catch((error) => {
      logger.error(
        `Error deleting documents' files for agreement ${agreement.data.id} : ${error}`
      );
    });
  }

  return toCreateEventAgreementDeleted(agreementId, agreement.metadata.version);
}

export async function updateAgreementLogic({
  agreementId,
  agreement,
  authData,
  agreementToBeUpdated,
}: {
  agreementId: AgreementId;
  agreement: ApiAgreementUpdatePayload;
  authData: AuthData;
  agreementToBeUpdated: WithMetadata<Agreement> | undefined;
}): Promise<CreateEvent<AgreementEvent>> {
  assertAgreementExist(agreementId, agreementToBeUpdated);
  assertRequesterIsConsumer(agreementToBeUpdated.data, authData);

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
  copyFile,
}: {
  agreementId: AgreementId;
  authData: AuthData;
  agreementQuery: AgreementQuery;
  eserviceQuery: EserviceQuery;
  tenantQuery: TenantQuery;
  copyFile: (
    bucket: string,
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
  assertRequesterIsConsumer(agreementToBeUpgraded.data, authData);

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
    const stamp = createStamp(authData);
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
      id: generateId(),
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

    const newAgreement: Agreement = {
      id: generateId(),
      eserviceId: agreementToBeUpgraded.data.eserviceId,
      descriptorId: newDescriptor.id,
      producerId: agreementToBeUpgraded.data.producerId,
      consumerId: agreementToBeUpgraded.data.consumerId,
      verifiedAttributes: agreementToBeUpgraded.data.verifiedAttributes,
      certifiedAttributes: agreementToBeUpgraded.data.certifiedAttributes,
      declaredAttributes: agreementToBeUpgraded.data.declaredAttributes,
      consumerNotes: agreementToBeUpgraded.data.consumerNotes,
      state: agreementState.draft,
      createdAt: new Date(),
      consumerDocuments: [],
      stamps: {},
    };

    const createEvent = toCreateEventAgreementAdded(newAgreement);

    const docEvents = await createAndCopyDocumentsForClonedAgreement(
      newAgreement.id,
      agreementToBeUpgraded.data,
      1,
      copyFile
    );

    return {
      streamId: createEvent.streamId,
      events: [createEvent, ...docEvents],
    };
  }
}

export async function cloneAgreementLogic({
  agreementId,
  authData,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  copyFile,
}: {
  agreementId: AgreementId;
  authData: AuthData;
  agreementQuery: AgreementQuery;
  tenantQuery: TenantQuery;
  eserviceQuery: EserviceQuery;
  copyFile: (
    bucket: string,
    sourcePath: string,
    destinationPath: string,
    destinationFileName: string,
    docName: string
  ) => Promise<string>;
}): Promise<{ streamId: string; events: Array<CreateEvent<AgreementEvent>> }> {
  const agreementToBeCloned = await agreementQuery.getAgreementById(
    agreementId
  );
  assertAgreementExist(agreementId, agreementToBeCloned);
  assertRequesterIsConsumer(agreementToBeCloned.data, authData);

  assertExpectedState(agreementId, agreementToBeCloned.data.state, [
    agreementState.rejected,
  ]);

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeCloned.data.eserviceId
  );
  assertEServiceExist(agreementToBeCloned.data.eserviceId, eservice);

  const activeAgreement = await agreementQuery.getAllAgreements({
    consumerId: authData.organizationId,
    eserviceId: agreementToBeCloned.data.eserviceId,
    agreementStates: agreementCloningConflictingStates,
  });
  if (activeAgreement.length > 0) {
    throw agreementAlreadyExists(
      authData.organizationId,
      agreementToBeCloned.data.eserviceId
    );
  }

  const consumer = await tenantQuery.getTenantById(
    agreementToBeCloned.data.consumerId
  );
  assertTenantExist(agreementToBeCloned.data.consumerId, consumer);

  const descriptor = eservice.data.descriptors.find(
    (d) => d.id === agreementToBeCloned.data.descriptorId
  );
  assertDescriptorExist(
    eservice.data.id,
    agreementToBeCloned.data.descriptorId,
    descriptor
  );

  validateCertifiedAttributes(descriptor, consumer.data);

  const newAgreement: Agreement = {
    id: generateId(),
    eserviceId: agreementToBeCloned.data.eserviceId,
    descriptorId: agreementToBeCloned.data.descriptorId,
    producerId: agreementToBeCloned.data.producerId,
    consumerId: agreementToBeCloned.data.consumerId,
    consumerNotes: agreementToBeCloned.data.consumerNotes,
    verifiedAttributes: [],
    certifiedAttributes: [],
    declaredAttributes: [],
    state: agreementState.draft,
    createdAt: new Date(),
    consumerDocuments: [],
    stamps: {},
  };

  const createEvent = toCreateEventAgreementAdded(newAgreement);

  const docEvents = await createAndCopyDocumentsForClonedAgreement(
    newAgreement.id,
    agreementToBeCloned.data,
    0,
    copyFile
  );

  return {
    streamId: createEvent.streamId,
    events: [createEvent, ...docEvents],
  };
}

export async function rejectAgreementLogic({
  agreementId,
  rejectionReason,
  authData,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
}: {
  agreementId: AgreementId;
  rejectionReason: string;
  authData: AuthData;
  agreementQuery: AgreementQuery;
  tenantQuery: TenantQuery;
  eserviceQuery: EserviceQuery;
}): Promise<CreateEvent<AgreementEvent>> {
  const agreementToBeRejected = await agreementQuery.getAgreementById(
    agreementId
  );
  assertAgreementExist(agreementId, agreementToBeRejected);

  assertRequesterIsProducer(agreementToBeRejected.data, authData);

  assertExpectedState(
    agreementId,
    agreementToBeRejected.data.state,
    agreementRejectableStates
  );

  const eservice = await eserviceQuery.getEServiceById(
    agreementToBeRejected.data.eserviceId
  );
  assertEServiceExist(agreementToBeRejected.data.eserviceId, eservice);

  const consumer = await tenantQuery.getTenantById(
    agreementToBeRejected.data.consumerId
  );
  assertTenantExist(agreementToBeRejected.data.consumerId, consumer);

  const descriptor = eservice.data.descriptors.find(
    (d) => d.id === agreementToBeRejected.data.descriptorId
  );
  assertDescriptorExist(
    eservice.data.id,
    agreementToBeRejected.data.descriptorId,
    descriptor
  );

  const stamp = createStamp(authData);
  const rejected: Agreement = {
    ...agreementToBeRejected.data,
    state: agreementState.rejected,
    certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer.data),
    declaredAttributes: matchingDeclaredAttributes(descriptor, consumer.data),
    verifiedAttributes: matchingVerifiedAttributes(
      eservice.data,
      descriptor,
      consumer.data
    ),
    rejectionReason,
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    suspendedByPlatform: undefined,
    stamps: {
      ...agreementToBeRejected.data.stamps,
      rejection: stamp,
    },
  };

  return toCreateEventAgreementUpdated(
    rejected,
    agreementToBeRejected.metadata.version
  );
}

export async function archiveAgreementLogic(
  agreementId: Agreement["id"],
  authData: AuthData,
  agreementQuery: AgreementQuery
): Promise<CreateEvent<AgreementUpdateEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);

  const updateSeed = {
    ...agreement.data,
    state: agreementState.archived,
    stamps: {
      ...agreement.data.stamps,
      archiving: createStamp(authData),
    },
  };

  const updatedAgreement = {
    ...agreement.data,
    ...updateSeed,
  };

  return toCreateEventAgreementUpdated(
    updatedAgreement,
    agreement.metadata.version
  );
}
