import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import {
  Descriptor,
  DescriptorId,
  DescriptorState,
  Document,
  EService,
  EServiceDocumentId,
  EServiceEvent,
  EServiceId,
  TenantId,
  WithMetadata,
  catalogEventToBinaryData,
  descriptorState,
  generateId,
  operationForbidden,
  unsafeBrandId,
  ListResult,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  Consumer,
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptorActivated,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorDeleted,
  toCreateEventEServiceDescriptorPublished,
  toCreateEventEServiceDescriptorSuspended,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
  ApiGetEServicesFilters,
} from "../model/types.js";
import { config } from "../utilities/config.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import {
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  notValidDescriptor,
  eServiceNotFound,
  eServiceDescriptorWithoutInterface,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

const fileManager = initFileManager(config);

function assertEServiceExist(
  eserviceId: EServiceId,
  eservice: WithMetadata<EService> | undefined
): asserts eservice is NonNullable<WithMetadata<EService>> {
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
}

const assertRequesterAllowed = (
  producerId: TenantId,
  requesterId: TenantId
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

export const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService>> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
  eservice: WithMetadata<EService>
): Descriptor => {
  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eservice.data.id, descriptorId);
  }

  return descriptor;
};

const updateDescriptorState = (
  descriptor: Descriptor,
  newState: DescriptorState
): Descriptor => {
  const descriptorStateChange = [descriptor.state, newState];

  return match(descriptorStateChange)
    .with([descriptorState.draft, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      publishedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.suspended], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.published], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
    }))
    .with([descriptorState.suspended, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      deprecatedAt: new Date(),
    }))
    .with([descriptorState.suspended, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      suspendedAt: undefined,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.archived], () => ({
      ...descriptor,
      state: newState,
      archivedAt: new Date(),
    }))
    .with([descriptorState.published, descriptorState.deprecated], () => ({
      ...descriptor,
      state: newState,
      deprecatedAt: new Date(),
    }))
    .otherwise(() => ({
      ...descriptor,
      state: newState,
    }));
};

const deprecateDescriptor = (
  eserviceId: EServiceId,
  descriptor: Descriptor
): Descriptor => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eserviceId}`
  );

  return updateDescriptorState(descriptor, descriptorState.deprecated);
};

const hasNotDraftDescriptor = (eservice: EService): void => {
  const hasDraftDescriptor = eservice.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft
  );
  if (hasDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, catalogEventToBinaryData);
  return {
    async createEService(
      apiEServicesSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<EServiceId> {
      logger.info(
        `Creating EService with service name ${apiEServicesSeed.name}`
      );
      return unsafeBrandId<EServiceId>(
        await repository.createEvent(
          createEserviceLogic({
            eservice: await readModelService.getEServiceByNameAndProducerId({
              name: apiEServicesSeed.name,
              producerId: authData.organizationId,
            }),
            apiEServicesSeed,
            authData,
          })
        )
      );
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<WithMetadata<EService>> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eService = await readModelService.getEServiceById(eserviceId);
      assertEServiceExist(eserviceId, eService);
      return eService;
    },
    async getEServices(
      authData: AuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      // "Getting e-service with name = $name, ids = $eServicesIds, producers = $producersIds, states = $states, agreementStates = $agreementStates, limit = $limit, offset = $offset"
      logger.info(
        `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, limit = ${limit}, offset = ${offset}`
      );
      return await readModelService.getEServices(
        authData.organizationId,
        filters,
        offset,
        limit
      );
    },
    async getEServiceConsumers(
      eServiceId: EServiceId,
      offset: number,
      limit: number
    ): Promise<ListResult<Consumer>> {
      logger.info(`Retrieving consumers for EService ${eServiceId}`);
      return await readModelService.getEServiceConsumers(
        eServiceId,
        offset,
        limit
      );
    },
    async updateEService(
      eserviceId: EServiceId,
      eServiceSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Updating EService ${eserviceId}`);
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateEserviceLogic({ eservice, eserviceId, authData, eServiceSeed })
      );
    },

    async deleteEService(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        deleteEserviceLogic({ eserviceId, authData, eservice })
      );
    },

    async uploadDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      document: ApiEServiceDescriptorDocumentSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Creating EService Document ${document.documentId.toString} of kind ${document.kind}, name ${document.fileName}, path ${document.filePath} for EService ${eserviceId} and Descriptor ${descriptorId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        uploadDocumentLogic({
          eserviceId,
          descriptorId,
          document,
          authData,
          eservice,
        })
      );
    },
    async getDocumentById(
      eServiceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId
    ): Promise<Document> {
      logger.info(
        `Retrieving EService document ${documentId} for EService ${eServiceId} and descriptor ${descriptorId}`
      );
      const document = await readModelService.getDocumentById(
        eServiceId,
        descriptorId,
        documentId
      );

      if (document === undefined) {
        throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
      }
      return document;
    },
    async deleteDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await deleteDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          authData,
          eservice,
          deleteRemoteFile: fileManager.deleteFile,
        })
      );
    },

    async updateDocument(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating Document ${documentId} of Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await updateDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          apiEServiceDescriptorDocumentUpdateSeed,
          authData,
          eservice,
        })
      );
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: EServiceDescriptorSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eservice = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        createDescriptorLogic({
          eserviceId,
          eserviceDescriptorSeed,
          authData,
          eservice,
        })
      );
    },

    async deleteDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);
      await repository.createEvent(
        await deleteDraftDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          deleteFile: fileManager.deleteFile,
          eservice,
        })
      );
    },

    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eservice,
        })
      );
    },

    async publishDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        publishDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async suspendDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        suspendDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async activateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        activateDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },

    async cloneDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      const { eservice: draftEService, event } = await cloneDescriptorLogic({
        eserviceId,
        descriptorId,
        authData,
        copyFile: fileManager.copy,
        eservice,
      });

      await repository.createEvent(event);

      return draftEService;
    },

    async archiveDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Archiving Descriptor ${descriptorId} for EService ${eserviceId}`
      );

      const eservice = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        archiveDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eservice,
        })
      );
    },
  };
}

export function createEserviceLogic({
  eservice,
  apiEServicesSeed,
  authData,
}: {
  eservice: WithMetadata<EService> | undefined;
  apiEServicesSeed: ApiEServiceSeed;
  authData: AuthData;
}): CreateEvent<EServiceEvent> {
  if (eservice) {
    throw eServiceDuplicate(apiEServicesSeed.name);
  }

  const newEService: EService = {
    id: generateId(),
    producerId: authData.organizationId,
    name: apiEServicesSeed.name,
    description: apiEServicesSeed.description,
    technology: apiTechnologyToTechnology(apiEServicesSeed.technology),
    attributes: undefined,
    descriptors: [],
    createdAt: new Date(),
  };

  return toCreateEventEServiceAdded(newEService);
}

export function updateEserviceLogic({
  eservice,
  eserviceId,
  authData,
  eServiceSeed,
}: {
  eservice: WithMetadata<EService> | undefined;
  eserviceId: EServiceId;
  authData: AuthData;
  eServiceSeed: ApiEServiceSeed;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  if (
    !(
      eservice.data.descriptors.length === 0 ||
      (eservice.data.descriptors.length === 1 &&
        eservice.data.descriptors[0].state === descriptorState.draft)
    )
  ) {
    throw eServiceCannotBeUpdated(eserviceId);
  }

  const updatedEService: EService = {
    ...eservice.data,
    description: eServiceSeed.description,
    name: eServiceSeed.name,
    technology: apiTechnologyToTechnology(eServiceSeed.technology),
    producerId: authData.organizationId,
  };

  return toCreateEventEServiceUpdated(
    eserviceId,
    eservice.metadata.version,
    updatedEService
  );
}

export function deleteEserviceLogic({
  eserviceId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  if (eservice.data.descriptors.length > 0) {
    throw eServiceCannotBeDeleted(eserviceId);
  }

  return toCreateEventEServiceDeleted(
    eserviceId,
    eservice.metadata.version,
    eservice.data
  );
}

export function uploadDocumentLogic({
  eserviceId,
  descriptorId,
  document,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  document: ApiEServiceDescriptorDocumentSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );
  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eserviceId, descriptorId);
  }

  const isInterface = document.kind === "INTERFACE";
  const newDocument: Document = {
    id: unsafeBrandId(document.documentId),
    name: document.fileName,
    contentType: document.contentType,
    prettyName: document.prettyName,
    path: document.filePath,
    checksum: document.checksum,
    uploadDate: new Date(),
  };

  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId
        ? {
            ...d,
            interface: isInterface ? newDocument : d.interface,
            docs: isInterface ? d.docs : [...d.docs, newDocument],
            serverUrls: document.serverUrls,
          }
        : d
    ),
  };

  return toCreateEventEServiceDocumentAdded(
    eserviceId,
    eservice.metadata.version,
    {
      descriptorId,
      documentId: unsafeBrandId(document.documentId),
      eservice: newEservice,
      isInterface: document.kind === "INTERFACE",
    }
  );
}

export async function deleteDocumentLogic({
  eserviceId,
  descriptorId,
  documentId,
  authData,
  eservice,
  deleteRemoteFile,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
  deleteRemoteFile: (container: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  const document = (
    descriptor ? [...descriptor.docs, descriptor.interface] : []
  ).find((doc) => doc != null && doc.id === documentId);
  if (document === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
  }

  await deleteRemoteFile(config.storageContainer, document.path);

  const isInterface = document.id === descriptor?.interface?.id;
  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId
        ? {
            ...d,
            interface: d.interface?.id === documentId ? undefined : d.interface,
            docs: d.docs.filter((doc) => doc.id !== documentId),
          }
        : d
    ),
  };

  return toCreateEventEServiceDocumentDeleted(
    eserviceId,
    eservice.metadata.version,
    {
      descriptorId,
      documentId,
      eservice: newEservice,
      isInterface,
    }
  );
}

export async function updateDocumentLogic({
  eserviceId,
  descriptorId,
  documentId,
  apiEServiceDescriptorDocumentUpdateSeed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );
  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eserviceId, descriptorId);
  }

  const document = (
    descriptor ? [...descriptor.docs, descriptor.interface] : []
  ).find((doc) => doc != null && doc.id === documentId);

  if (document === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
  }

  const updatedDocument = {
    ...document,
    prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
  };

  const isInterface = document.id === descriptor?.interface?.id;
  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId
        ? {
            ...d,
            interface: isInterface ? updatedDocument : d.interface,
            docs: d.docs.map((doc) =>
              doc.id === documentId ? updatedDocument : doc
            ),
          }
        : d
    ),
  };

  return toCreateEventEServiceDocumentUpdated(
    eserviceId,
    eservice.metadata.version,
    {
      descriptorId,
      documentId,
      eservice: newEservice,
      isInterface,
    }
  );
}

export function createDescriptorLogic({
  eserviceId,
  eserviceDescriptorSeed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  eserviceDescriptorSeed: EServiceDescriptorSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);
  hasNotDraftDescriptor(eservice.data);

  const newVersion = nextDescriptorVersion(eservice.data);

  const certifiedAttributes = eserviceDescriptorSeed.attributes.certified;

  const descriptorId = generateId<DescriptorId>();

  const newDescriptor: Descriptor = {
    id: descriptorId,
    description: eserviceDescriptorSeed.description,
    version: newVersion,
    interface: undefined,
    docs: [],
    state: "Draft",
    voucherLifespan: eserviceDescriptorSeed.voucherLifespan,
    audience: eserviceDescriptorSeed.audience,
    dailyCallsPerConsumer: eserviceDescriptorSeed.dailyCallsPerConsumer,
    dailyCallsTotal: eserviceDescriptorSeed.dailyCallsTotal,
    agreementApprovalPolicy:
      apiAgreementApprovalPolicyToAgreementApprovalPolicy(
        eserviceDescriptorSeed.agreementApprovalPolicy
      ),
    serverUrls: [],
    publishedAt: undefined,
    suspendedAt: undefined,
    deprecatedAt: undefined,
    archivedAt: undefined,
    createdAt: new Date(),
    attributes: {
      certified: certifiedAttributes.map((a) =>
        a.map((a) => ({
          ...a,
          id: unsafeBrandId(a.id),
        }))
      ),
      declared: [],
      verified: [],
    },
  };

  const newEservice: EService = {
    ...eservice.data,
    descriptors: [...eservice.data.descriptors, newDescriptor],
  };

  return toCreateEventEServiceDescriptorAdded(
    eservice.data.id,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export async function deleteDraftDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  deleteFile,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  deleteFile: (container: string, path: string) => Promise<void>;
  eservice: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) =>
      d.id === descriptorId && d.state === descriptorState.draft
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eserviceId, descriptorId);
  }

  const interfacePath = descriptor.interface;
  if (interfacePath !== undefined) {
    await deleteFile(config.storageContainer, interfacePath.path);
  }

  const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
    deleteFile(config.storageContainer, doc.path)
  );

  await Promise.all(deleteDescriptorDocs).catch((error) => {
    logger.error(
      `Error deleting documents for descriptor ${descriptorId} : ${error}`
    );
  });

  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.filter(
      (d: Descriptor) => d.id !== descriptorId
    ),
  };

  return toCreateEventEServiceDescriptorDeleted(
    eservice.data.id,
    eservice.metadata.version,
    newEservice,
    descriptorId
  );
}

export function updateDescriptorLogic({
  eserviceId,
  descriptorId,
  seed,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  seed: UpdateEServiceDescriptorSeed;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );
  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eserviceId, descriptorId);
  }

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const updatedDescriptor: Descriptor = {
    ...descriptor,
    description: seed.description,
    audience: seed.audience,
    voucherLifespan: seed.voucherLifespan,
    dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    state: "Draft",
    dailyCallsTotal: seed.dailyCallsTotal,
    agreementApprovalPolicy:
      apiAgreementApprovalPolicyToAgreementApprovalPolicy(
        seed.agreementApprovalPolicy
      ),
  };

  const filteredDescriptor = eservice.data.descriptors.filter(
    (d: Descriptor) => d.id !== descriptorId
  );

  const updatedEService: EService = {
    ...eservice.data,
    descriptors: [...filteredDescriptor, updatedDescriptor],
  };

  return toCreateEventEServiceUpdated(
    eserviceId,
    eservice.metadata.version,
    updatedEService
  );
}

export function publishDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);
  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state.toString());
  }

  if (descriptor.interface === undefined) {
    throw eServiceDescriptorWithoutInterface(descriptor.id);
  }

  const currentActiveDescriptor = eservice.data.descriptors.find(
    (d: Descriptor) => d.state === descriptorState.published
  );

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );

  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId ? updatedDescriptor : d
    ),
  };

  if (currentActiveDescriptor !== undefined) {
    const newEserviceWithDeprecation: EService = {
      ...eservice.data,
      descriptors: eservice.data.descriptors.map((d: Descriptor) =>
        d.id === currentActiveDescriptor.id
          ? deprecateDescriptor(eserviceId, currentActiveDescriptor)
          : d
      ),
    };

    return toCreateEventEServiceDescriptorPublished(
      eserviceId,
      eservice.metadata.version + 1,
      descriptorId,
      newEserviceWithDeprecation,
      currentActiveDescriptor.id
    );
  } else {
    return toCreateEventEServiceDescriptorPublished(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      newEservice
    );
  }
}

export function suspendDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);
  if (
    descriptor.state !== descriptorState.deprecated &&
    descriptor.state !== descriptorState.published
  ) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.suspended
  );

  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId ? updatedDescriptor : d
    ),
  };

  return toCreateEventEServiceDescriptorSuspended(
    eserviceId,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export function activateDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);
  if (descriptor.state !== descriptorState.suspended) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );
  const descriptorVersions: number[] = eservice.data.descriptors
    .filter(
      (d: Descriptor) =>
        d.state === descriptorState.suspended ||
        d.state === descriptorState.deprecated ||
        d.state === descriptorState.published
    )
    .map((d: Descriptor) => parseInt(d.version, 10));
  const recentDescriptorVersion = Math.max(...descriptorVersions);

  if (
    recentDescriptorVersion !== null &&
    parseInt(descriptor.version, 10) === recentDescriptorVersion
  ) {
    logger.info(
      `Publishing Descriptor ${descriptorId} of EService ${eserviceId}`
    );

    const newEservice: EService = {
      ...eservice.data,
      descriptors: eservice.data.descriptors.map((d: Descriptor) =>
        d.id === descriptorId ? updatedDescriptor : d
      ),
    };

    return toCreateEventEServiceDescriptorActivated(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      newEservice
    );
  } else {
    const newEservice: EService = {
      ...eservice.data,
      descriptors: eservice.data.descriptors.map((d: Descriptor) =>
        d.id === descriptorId ? deprecateDescriptor(eserviceId, descriptor) : d
      ),
    };

    return toCreateEventEServiceDescriptorActivated(
      eserviceId,
      eservice.metadata.version,
      descriptorId,
      newEservice
    );
  }
}

export async function cloneDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  copyFile,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  copyFile: (
    container: string,
    docPath: string,
    path: string,
    id: string,
    name: string
  ) => Promise<string>;
  eservice: WithMetadata<EService> | undefined;
}): Promise<{ eservice: EService; event: CreateEvent<EServiceEvent> }> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  const sourceDocument = descriptor.docs[0];
  const clonedDocumentId = generateId<EServiceDocumentId>();

  const clonedInterfacePath =
    descriptor.interface !== undefined
      ? await copyFile(
          config.storageContainer,
          config.eserviceDocumentsPath,
          descriptor.interface.path,
          clonedDocumentId,
          descriptor.interface.name
        )
      : undefined;

  const clonedInterfaceDocument: Document | undefined =
    clonedInterfacePath !== undefined
      ? {
          id: clonedDocumentId,
          name: sourceDocument.name,
          contentType: sourceDocument.contentType,
          prettyName: sourceDocument.prettyName,
          path: clonedInterfacePath,
          checksum: sourceDocument.checksum,
          uploadDate: new Date(),
        }
      : undefined;

  const clonedDocuments = await Promise.all(
    descriptor.docs.map(async (doc: Document) => {
      const clonedDocumentId = generateId<EServiceDocumentId>();
      const clonedPath = await copyFile(
        config.storageContainer,
        config.eserviceDocumentsPath,
        doc.path,
        clonedDocumentId,
        doc.name
      );
      const clonedDocument: Document = {
        id: clonedDocumentId,
        name: doc.name,
        contentType: doc.contentType,
        prettyName: doc.prettyName,
        path: clonedPath,
        checksum: doc.checksum,
        uploadDate: new Date(),
      };
      return clonedDocument;
    })
  );

  const clonedEservice: EService = {
    id: generateId(),
    producerId: eservice.data.producerId,
    name: `${eservice.data.name} - clone`,
    description: eservice.data.description,
    technology: eservice.data.technology,
    attributes: eservice.data.attributes,
    createdAt: new Date(),
    descriptors: [
      {
        ...descriptor,
        id: generateId(),
        version: "1",
        interface: clonedInterfaceDocument,
        docs: clonedDocuments,
        state: descriptorState.draft,
        createdAt: new Date(),
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        archivedAt: undefined,
      },
    ],
  };

  return {
    eservice: clonedEservice,
    event: toCreateEventClonedEServiceAdded(
      descriptorId,
      eservice.data,
      clonedEservice
    ),
  };
}

export function archiveDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  eservice,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eservice: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eservice);
  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.archived
  );

  const newEservice: EService = {
    ...eservice.data,
    descriptors: eservice.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId ? updatedDescriptor : d
    ),
  };

  return toCreateEventEServiceDescriptorActivated(
    eserviceId,
    eservice.metadata.version,
    descriptorId,
    newEservice
  );
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
