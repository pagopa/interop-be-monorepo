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
  DescriptorState,
  Document,
  EService,
  EServiceEvent,
  WithMetadata,
  catalogEventToBinaryData,
  descriptorState,
  operationForbidden,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
} from "../model/domain/models.js";
import {
  toCreateEventClonedEServiceAdded,
  toCreateEventEServiceAdded,
  toCreateEventEServiceDeleted,
  toCreateEventEServiceDescriptorAdded,
  toCreateEventEServiceDescriptorUpdated,
  toCreateEventEServiceDocumentAdded,
  toCreateEventEServiceDocumentDeleted,
  toCreateEventEServiceDocumentUpdated,
  toCreateEventEServiceUpdated,
  toCreateEventEServiceWithDescriptorsDeleted,
} from "../model/domain/toEvent.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
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
  eServiceId: string,
  eService: WithMetadata<EService> | undefined
): asserts eService is NonNullable<WithMetadata<EService>> {
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
}

const assertRequesterAllowed = (
  producerId: string,
  requesterId: string
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

export const retrieveEService = async (
  eServiceId: string,
  readModelService: ReadModelService
): Promise<WithMetadata<EService>> => {
  const eService = await readModelService.getEServiceById(eServiceId);
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eService;
};

const retrieveDescriptor = (
  descriptorId: string,
  eService: WithMetadata<EService>
): Descriptor => {
  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eService.data.id, descriptorId);
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
  streamId: string,
  version: number,
  descriptor: Descriptor
): CreateEvent<EServiceEvent> => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${streamId}`
  );

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.deprecated
  );
  return toCreateEventEServiceDescriptorUpdated(
    streamId,
    version,
    updatedDescriptor
  );
};

const hasNotDraftDescriptor = (eService: EService): void => {
  const hasDraftDescriptor = eService.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft
  );
  if (hasDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eService.id);
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
    ): Promise<string> {
      return repository.createEvent(
        createEserviceLogic({
          eService: await readModelService.getEServiceByNameAndProducerId({
            name: apiEServicesSeed.name,
            producerId: authData.organizationId,
          }),
          apiEServicesSeed,
          authData,
        })
      );
    },

    async updateEService(
      eServiceId: string,
      eServiceSeed: ApiEServiceSeed,
      authData: AuthData
    ): Promise<void> {
      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        updateEserviceLogic({ eService, eServiceId, authData, eServiceSeed })
      );
    },

    async deleteEService(
      eServiceId: string,
      authData: AuthData
    ): Promise<void> {
      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        deleteEserviceLogic({ eServiceId, authData, eService })
      );
    },

    async uploadDocument(
      eServiceId: string,
      descriptorId: string,
      document: ApiEServiceDescriptorDocumentSeed,
      authData: AuthData
    ): Promise<string> {
      const eService = await readModelService.getEServiceById(eServiceId);

      return await repository.createEvent(
        uploadDocumentLogic({
          eServiceId,
          descriptorId,
          document,
          authData,
          eService,
        })
      );
    },

    async deleteDocument(
      eServiceId: string,
      descriptorId: string,
      documentId: string,
      authData: AuthData
    ): Promise<void> {
      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        await deleteDocumentLogic({
          eServiceId,
          descriptorId,
          documentId,
          authData,
          eService,
          deleteRemoteFile: fileManager.deleteFile,
        })
      );
    },

    async updateDocument(
      eServiceId: string,
      descriptorId: string,
      documentId: string,
      apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
      authData: AuthData
    ): Promise<void> {
      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        await updateDocumentLogic({
          eServiceId,
          descriptorId,
          documentId,
          apiEServiceDescriptorDocumentUpdateSeed,
          authData,
          eService,
        })
      );
    },

    async createDescriptor(
      eServiceId: string,
      eserviceDescriptorSeed: EServiceDescriptorSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Creating Descriptor for EService ${eServiceId}`);

      const eService = await readModelService.getEServiceById(eServiceId);

      return await repository.createEvent(
        createDescriptorLogic({
          eServiceId,
          eserviceDescriptorSeed,
          authData,
          eService,
        })
      );
    },

    async deleteDraftDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Deleting draft Descriptor ${descriptorId} of EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);
      await repository.createEvent(
        await deleteDraftDescriptorLogic({
          eServiceId,
          descriptorId,
          authData,
          deleteFile: fileManager.deleteFile,
          eService,
        })
      );
    },

    async updateDescriptor(
      eServiceId: string,
      descriptorId: string,
      seed: UpdateEServiceDescriptorSeed,
      authData: AuthData
    ): Promise<void> {
      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        updateDescriptorLogic({
          eServiceId,
          descriptorId,
          seed,
          authData,
          eService,
        })
      );
    },

    async publishDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Publishing Descriptor $descriptorId of EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);

      for (const event of publishDescriptorLogic({
        eServiceId,
        descriptorId,
        authData,
        eService,
      })) {
        await repository.createEvent(event);
      }
    },

    async suspendDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Suspending Descriptor ${descriptorId} of EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        suspendDescriptorLogic({
          eServiceId,
          descriptorId,
          authData,
          eService,
        })
      );
    },

    async activateDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Activating descriptor ${descriptorId} for EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        activateDescriptorLogic({
          eServiceId,
          descriptorId,
          authData,
          eService,
        })
      );
    },

    async cloneDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<EService> {
      logger.info(
        `Cloning Descriptor ${descriptorId} of EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);

      const { eService: draftEService, event } = await cloneDescriptorLogic({
        eServiceId,
        descriptorId,
        authData,
        copyFile: fileManager.copy,
        eService,
      });

      await repository.createEvent(event);

      return draftEService;
    },

    async archiveDescriptor(
      eServiceId: string,
      descriptorId: string,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Archiving descriptor ${descriptorId} of EService ${eServiceId}`
      );

      const eService = await readModelService.getEServiceById(eServiceId);

      await repository.createEvent(
        archiveDescriptorLogic({
          eServiceId,
          descriptorId,
          authData,
          eService,
        })
      );
    },
  };
}

export function createEserviceLogic({
  eService,
  apiEServicesSeed,
  authData,
}: {
  eService: WithMetadata<EService> | undefined;
  apiEServicesSeed: ApiEServiceSeed;
  authData: AuthData;
}): CreateEvent<EServiceEvent> {
  if (eService) {
    throw eServiceDuplicate(apiEServicesSeed.name);
  }

  const newEService: EService = {
    id: uuidv4(),
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
  eService,
  eServiceId,
  authData,
  eServiceSeed,
}: {
  eService: WithMetadata<EService> | undefined;
  eServiceId: string;
  authData: AuthData;
  eServiceSeed: ApiEServiceSeed;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  if (
    !(
      eService.data.descriptors.length === 0 ||
      (eService.data.descriptors.length === 1 &&
        eService.data.descriptors[0].state === descriptorState.draft)
    )
  ) {
    throw eServiceCannotBeUpdated(eServiceId);
  }

  const updatedEService: EService = {
    ...eService.data,
    description: eServiceSeed.description,
    name: eServiceSeed.name,
    technology: apiTechnologyToTechnology(eServiceSeed.technology),
    producerId: authData.organizationId,
  };

  return toCreateEventEServiceUpdated(
    eServiceId,
    eService.metadata.version,
    updatedEService
  );
}

export function deleteEserviceLogic({
  eServiceId,
  authData,
  eService,
}: {
  eServiceId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  if (eService.data.descriptors.length > 0) {
    throw eServiceCannotBeDeleted(eServiceId);
  }

  return toCreateEventEServiceDeleted(eServiceId, eService.metadata.version);
}

export function uploadDocumentLogic({
  eServiceId,
  descriptorId,
  document,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  document: ApiEServiceDescriptorDocumentSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );
  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eServiceId, descriptorId);
  }

  return toCreateEventEServiceDocumentAdded(
    eServiceId,
    eService.metadata.version,
    descriptorId,
    {
      newDocument: {
        id: document.documentId,
        name: document.fileName,
        contentType: document.contentType,
        prettyName: document.prettyName,
        path: document.filePath,
        checksum: document.checksum,
        uploadDate: new Date(),
      },
      isInterface: document.kind === "INTERFACE",
      serverUrls: document.serverUrls,
    }
  );
}

export async function deleteDocumentLogic({
  eServiceId,
  descriptorId,
  documentId,
  authData,
  eService,
  deleteRemoteFile,
}: {
  eServiceId: string;
  descriptorId: string;
  documentId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
  deleteRemoteFile: (container: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );

  const document = (
    descriptor ? [...descriptor.docs, descriptor.interface] : []
  ).find((doc) => doc != null && doc.id === documentId);
  if (document === undefined) {
    throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
  }

  await deleteRemoteFile(config.storageContainer, document.path);

  return toCreateEventEServiceDocumentDeleted(
    eServiceId,
    eService.metadata.version,
    descriptorId,
    documentId
  );
}

export async function updateDocumentLogic({
  eServiceId,
  descriptorId,
  documentId,
  apiEServiceDescriptorDocumentUpdateSeed,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  documentId: string;
  apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.id === descriptorId
  );
  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eServiceId, descriptorId);
  }

  const document = (
    descriptor ? [...descriptor.docs, descriptor.interface] : []
  ).find((doc) => doc != null && doc.id === documentId);

  if (document === undefined) {
    throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
  }

  const updatedDocument = {
    ...document,
    prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
  };

  return toCreateEventEServiceDocumentUpdated({
    streamId: eServiceId,
    version: eService.metadata.version,
    descriptorId,
    documentId,
    updatedDocument,
    serverUrls: descriptor.serverUrls,
  });
}

export function createDescriptorLogic({
  eServiceId,
  eserviceDescriptorSeed,
  authData,
  eService,
}: {
  eServiceId: string;
  eserviceDescriptorSeed: EServiceDescriptorSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);
  hasNotDraftDescriptor(eService.data);

  const newVersion = nextDescriptorVersion(eService.data);

  const certifiedAttributes = eserviceDescriptorSeed.attributes.certified;

  const newDescriptor: Descriptor = {
    id: uuidv4(),
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
      certified: certifiedAttributes,
      declared: [],
      verified: [],
    },
  };

  return toCreateEventEServiceDescriptorAdded(
    eService.data.id,
    eService.metadata.version,
    newDescriptor
  );
}

export async function deleteDraftDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  deleteFile,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  deleteFile: (container: string, path: string) => Promise<void>;
  eService: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = eService.data.descriptors.find(
    (d: Descriptor) =>
      d.id === descriptorId && d.state === descriptorState.draft
  );

  if (descriptor === undefined) {
    throw eServiceDescriptorNotFound(eServiceId, descriptorId);
  }

  const interfacePath = descriptor.docs.find(
    (doc: Document) => doc.id === descriptorId
  );
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

  return toCreateEventEServiceWithDescriptorsDeleted(eService, descriptorId);
}

export function updateDescriptorLogic({
  eServiceId,
  descriptorId,
  seed,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  seed: UpdateEServiceDescriptorSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

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

  const filteredDescriptor = eService.data.descriptors.filter(
    (d: Descriptor) => d.id !== descriptorId
  );

  const updatedEService: EService = {
    ...eService.data,
    descriptors: [...filteredDescriptor, updatedDescriptor],
  };

  return toCreateEventEServiceUpdated(
    eServiceId,
    eService.metadata.version,
    updatedEService
  );
}

export function publishDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): Array<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);
  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state.toString());
  }

  if (descriptor.interface === undefined) {
    throw eServiceDescriptorWithoutInterface(descriptor.id);
  }

  const currentActiveDescriptor = eService.data.descriptors.find(
    (d: Descriptor) => d.state === descriptorState.published
  );

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );

  if (currentActiveDescriptor !== undefined) {
    return [
      deprecateDescriptor(
        eService.data.id,
        eService.metadata.version,
        currentActiveDescriptor
      ),
      toCreateEventEServiceDescriptorUpdated(
        eServiceId,
        eService.metadata.version + 1,
        updatedDescriptor
      ),
    ];
  } else {
    return [
      toCreateEventEServiceDescriptorUpdated(
        eServiceId,
        eService.metadata.version,
        updatedDescriptor
      ),
    ];
  }
}

export function suspendDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);
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

  return toCreateEventEServiceDescriptorUpdated(
    eServiceId,
    eService.metadata.version,
    updatedDescriptor
  );
}

export function activateDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);
  if (descriptor.state !== descriptorState.suspended) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.published
  );
  const descriptorVersions: number[] = eService.data.descriptors
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
      `Publishing Descriptor ${descriptorId} of EService ${eServiceId}`
    );

    return toCreateEventEServiceDescriptorUpdated(
      eServiceId,
      eService.metadata.version,
      updatedDescriptor
    );
  } else {
    return deprecateDescriptor(
      eServiceId,
      eService.metadata.version,
      descriptor
    );
  }
}

export async function cloneDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  copyFile,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  copyFile: (
    container: string,
    docPath: string,
    path: string,
    id: string,
    name: string
  ) => Promise<string>;
  eService: WithMetadata<EService> | undefined;
}): Promise<{ eService: EService; event: CreateEvent<EServiceEvent> }> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  const sourceDocument = descriptor.docs[0];
  const clonedDocumentId = uuidv4();

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
      const clonedDocumentId = uuidv4();
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

  const draftCatalogItem: EService = {
    id: uuidv4(),
    producerId: eService.data.producerId,
    name: `${eService.data.name} - clone`,
    description: eService.data.description,
    technology: eService.data.technology,
    attributes: eService.data.attributes,
    createdAt: new Date(),
    descriptors: [
      {
        ...descriptor,
        id: uuidv4(),
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
    eService: draftCatalogItem,
    event: toCreateEventClonedEServiceAdded(draftCatalogItem),
  };
}

export function archiveDescriptorLogic({
  eServiceId,
  descriptorId,
  authData,
  eService,
}: {
  eServiceId: string;
  descriptorId: string;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eServiceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);
  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.archived
  );

  return toCreateEventEServiceDescriptorUpdated(
    eServiceId,
    eService.metadata.version,
    updatedDescriptor
  );
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
