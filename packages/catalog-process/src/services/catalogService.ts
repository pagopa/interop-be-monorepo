import {
  AuthData,
  CreateEvent,
  DB,
  FileManager,
  eventRepository,
  hasPermission,
  logger,
  userRoles,
} from "pagopa-interop-commons";
import {
  Attribute,
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
  AttributeId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  Consumer,
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
  UpdateEServiceDescriptorQuotasSeed,
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
  interfaceAlreadyExists,
  attributeNotFound,
  inconsistentDailyCalls,
  originNotCompliant,
  dailyCallsCannotBeDecreased,
} from "../model/domain/errors.js";
import { formatClonedEServiceDate } from "../utilities/date.js";
import { ReadModelService } from "./readModelService.js";

function assertEServiceExist(
  eserviceId: EServiceId,
  eService: WithMetadata<EService> | undefined
): asserts eService is NonNullable<WithMetadata<EService>> {
  if (eService === undefined) {
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

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<WithMetadata<EService>> => {
  const eService = await readModelService.getEServiceById(eserviceId);
  if (eService === undefined) {
    throw eServiceNotFound(eserviceId);
  }
  return eService;
};

const retrieveDescriptor = (
  descriptorId: DescriptorId,
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

const retrieveDocument = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  documentId: EServiceDocumentId
): Document => {
  const doc = descriptor.docs.find((d) => d.id === documentId);
  if (doc === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptor.id, documentId);
  }
  return doc;
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
  readModelService: ReadModelService,
  fileManager: FileManager
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

      const eserviceWithSameName =
        await readModelService.getEServiceByNameAndProducerId({
          name: apiEServicesSeed.name,
          producerId: authData.organizationId,
        });
      return unsafeBrandId<EServiceId>(
        await repository.createEvent(
          createEserviceLogic({
            eserviceWithSameName,
            apiEServicesSeed,
            authData,
          })
        )
      );
    },
    async getEServiceById(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<EService> {
      logger.info(`Retrieving EService ${eserviceId}`);
      const eservice = await retrieveEService(eserviceId, readModelService);

      return applyVisibilityToEService(eservice.data, authData);
    },

    async getEServices(
      authData: AuthData,
      filters: ApiGetEServicesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      logger.info(
        `Getting EServices with name = ${filters.name}, ids = ${filters.eservicesIds}, producers = ${filters.producersIds}, states = ${filters.states}, agreementStates = ${filters.agreementStates}, limit = ${limit}, offset = ${offset}`
      );
      const eservicesList = await readModelService.getEServices(
        authData,
        filters,
        offset,
        limit
      );

      const eServicesToReturn = eservicesList.results.map((eservice) =>
        applyVisibilityToEService(eservice, authData)
      );

      return {
        results: eServicesToReturn,
        totalCount: eservicesList.totalCount,
      };
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
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await updateEserviceLogic({
          eService,
          eserviceId,
          authData,
          eServiceSeed,
          getEServiceByNameAndProducerId:
            readModelService.getEServiceByNameAndProducerId,
          deleteFile: fileManager.delete,
        })
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
    async getDocumentById({
      eserviceId,
      descriptorId,
      documentId,
      authData,
    }: {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
      documentId: EServiceDocumentId;
      authData: AuthData;
    }): Promise<Document> {
      logger.info(
        `Retrieving EService document ${documentId} for EService ${eserviceId} and descriptor ${descriptorId}`
      );
      const eService = await retrieveEService(eserviceId, readModelService);
      const descriptor = retrieveDescriptor(descriptorId, eService);
      const document = retrieveDocument(eserviceId, descriptor, documentId);
      const checkedEService = applyVisibilityToEService(
        eService.data,
        authData
      );
      if (!checkedEService.descriptors.find((d) => d.id === descriptorId)) {
        throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
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
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await deleteDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          authData,
          eService,
          deleteFile: fileManager.delete,
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
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        await updateDocumentLogic({
          eserviceId,
          descriptorId,
          documentId,
          apiEServiceDescriptorDocumentUpdateSeed,
          authData,
          eService,
        })
      );
    },

    async createDescriptor(
      eserviceId: EServiceId,
      eserviceDescriptorSeed: EServiceDescriptorSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(`Creating Descriptor for EService ${eserviceId}`);

      const eService = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        await createDescriptorLogic({
          eserviceId,
          eserviceDescriptorSeed,
          authData,
          eService,
          getAttributesByIds: readModelService.getAttributesByIds,
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
          deleteFile: fileManager.delete,
          eservice,
        })
      );
    },

    async updateDraftDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateDraftDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eService,
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

      for (const event of publishDescriptorLogic({
        eserviceId,
        descriptorId,
        authData,
        eservice,
      })) {
        await repository.createEvent(event);
      }
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

      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        activateDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eService,
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
        getEServiceByNameAndProducerId:
          readModelService.getEServiceByNameAndProducerId,
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

      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        archiveDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eService,
        })
      );
    },

    async updateDescriptor(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorQuotasSeed,
      authData: AuthData
    ): Promise<string> {
      logger.info(
        `Updating Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eService = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        updateDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eService,
        })
      );
    },
  };
}

export function createEserviceLogic({
  eserviceWithSameName,
  apiEServicesSeed,
  authData,
}: {
  eserviceWithSameName: WithMetadata<EService> | undefined;
  apiEServicesSeed: ApiEServiceSeed;
  authData: AuthData;
}): CreateEvent<EServiceEvent> {
  if (authData.externalId.origin !== "IPA") {
    throw originNotCompliant("IPA");
  }

  if (eserviceWithSameName) {
    throw eServiceDuplicate(apiEServicesSeed.name);
  }

  const newEService: EService = {
    id: generateId(),
    producerId: authData.organizationId,
    name: apiEServicesSeed.name,
    description: apiEServicesSeed.description,
    technology: apiTechnologyToTechnology(apiEServicesSeed.technology),
    mode: apiEServiceModeToEServiceMode(apiEServicesSeed.mode),
    attributes: undefined,
    descriptors: [],
    createdAt: new Date(),
    riskAnalysis: [],
  };

  return toCreateEventEServiceAdded(newEService);
}

export async function updateEserviceLogic({
  eService,
  eserviceId,
  authData,
  eServiceSeed,
  getEServiceByNameAndProducerId,
  deleteFile,
}: {
  eService: WithMetadata<EService> | undefined;
  eserviceId: EServiceId;
  authData: AuthData;
  eServiceSeed: ApiEServiceSeed;
  getEServiceByNameAndProducerId: ({
    name,
    producerId,
  }: {
    name: string;
    producerId: TenantId;
  }) => Promise<WithMetadata<EService> | undefined>;
  deleteFile: (container: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  if (
    !(
      eService.data.descriptors.length === 0 ||
      (eService.data.descriptors.length === 1 &&
        eService.data.descriptors[0].state === descriptorState.draft)
    )
  ) {
    throw eServiceCannotBeUpdated(eserviceId);
  }

  if (eServiceSeed.name !== eService.data.name) {
    const eServiceWithSameName = await getEServiceByNameAndProducerId({
      name: eServiceSeed.name,
      producerId: authData.organizationId,
    });
    if (eServiceWithSameName !== undefined) {
      throw eServiceDuplicate(eServiceSeed.name);
    }
  }

  const updatedTechnology = apiTechnologyToTechnology(eServiceSeed.technology);
  if (eService.data.descriptors.length === 1) {
    const draftDescriptor = eService.data.descriptors[0];
    if (
      updatedTechnology !== eService.data.technology &&
      draftDescriptor.interface !== undefined
    ) {
      await deleteFile(config.s3Bucket, draftDescriptor.interface.path).catch(
        (error) => {
          logger.error(
            `Error deleting interface for descriptor ${draftDescriptor.id} : ${error}`
          );
          throw error;
        }
      );
    }
  }

  const updatedEService: EService = {
    ...eService.data,
    description: eServiceSeed.description,
    name: eServiceSeed.name,
    technology: updatedTechnology,
    producerId: authData.organizationId,
  };

  return toCreateEventEServiceUpdated(
    eserviceId,
    eService.metadata.version,
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

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }

  if (document.kind === "INTERFACE" && descriptor.interface !== undefined) {
    throw interfaceAlreadyExists(descriptor.id);
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
  eService,
  deleteFile,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
  deleteFile: (bucket: string, path: string) => Promise<void>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }

  const document = [...descriptor.docs, descriptor.interface].find(
    (doc) => doc != null && doc.id === documentId
  );
  if (document === undefined) {
    throw eServiceDocumentNotFound(eserviceId, descriptorId, documentId);
  }

  await deleteFile(config.s3Bucket, document.path).catch((error) => {
    logger.error(
      `Error deleting interface or document file for descriptor ${descriptorId} : ${error}`
    );
    throw error;
  });

  const isInterface = document.id === descriptor?.interface?.id;
  const newEservice: EService = {
    ...eService.data,
    descriptors: eService.data.descriptors.map((d: Descriptor) =>
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
    eService.metadata.version,
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
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
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
    ...eService.data,
    descriptors: eService.data.descriptors.map((d: Descriptor) =>
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
    eService.metadata.version,
    {
      descriptorId,
      documentId,
      eservice: newEservice,
      isInterface,
    }
  );
}

export async function createDescriptorLogic({
  eserviceId,
  eserviceDescriptorSeed,
  authData,
  eService,
  getAttributesByIds,
}: {
  eserviceId: EServiceId;
  eserviceDescriptorSeed: EServiceDescriptorSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
  getAttributesByIds: (attributesIds: AttributeId[]) => Promise<Attribute[]>;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);
  hasNotDraftDescriptor(eService.data);

  const newVersion = nextDescriptorVersion(eService.data);

  const certifiedAttributes = eserviceDescriptorSeed.attributes.certified;
  const declaredAttributes = eserviceDescriptorSeed.attributes.declared;
  const verifiedAttributes = eserviceDescriptorSeed.attributes.verified;

  const attributesSeeds = [
    ...certifiedAttributes.flat(),
    ...declaredAttributes.flat(),
    ...verifiedAttributes.flat(),
  ];

  if (attributesSeeds.length > 0) {
    const attributesSeedsIds: AttributeId[] = attributesSeeds.map((attr) =>
      unsafeBrandId(attr.id)
    );
    const attributes = await getAttributesByIds(attributesSeedsIds);
    const attributesIds = attributes.map((attr) => attr.id);
    for (const attributeSeedId of attributesSeedsIds) {
      if (!attributesIds.includes(unsafeBrandId(attributeSeedId))) {
        throw attributeNotFound(attributeSeedId);
      }
    }
  }

  if (
    eserviceDescriptorSeed.dailyCallsPerConsumer >
    eserviceDescriptorSeed.dailyCallsTotal
  ) {
    throw inconsistentDailyCalls();
  }

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
      // eslint-disable-next-line sonarjs/no-identical-functions
      declared: declaredAttributes.map((a) =>
        a.map((a) => ({
          ...a,
          id: unsafeBrandId(a.id),
        }))
      ),
      // eslint-disable-next-line sonarjs/no-identical-functions
      verified: verifiedAttributes.map((a) =>
        a.map((a) => ({
          ...a,
          id: unsafeBrandId(a.id),
        }))
      ),
    },
  };

  const newEservice: EService = {
    ...eService.data,
    descriptors: [...eService.data.descriptors, newDescriptor],
  };

  return toCreateEventEServiceDescriptorAdded(
    eService.data.id,
    eService.metadata.version,
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

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const descriptorInterface = descriptor.interface;
  if (descriptorInterface !== undefined) {
    await deleteFile(config.s3Bucket, descriptorInterface.path).catch(
      (error) => {
        logger.error(
          `Error deleting interface file for descriptor ${descriptorId} : ${error}`
        );
        throw error;
      }
    );
  }

  const deleteDescriptorDocs = descriptor.docs.map((doc: Document) =>
    deleteFile(config.s3Bucket, doc.path)
  );

  await Promise.all(deleteDescriptorDocs).catch((error) => {
    logger.error(
      `Error deleting documents' files for descriptor ${descriptorId} : ${error}`
    );
    throw error;
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

export function updateDraftDescriptorLogic({
  eserviceId,
  descriptorId,
  seed,
  authData,
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  seed: UpdateEServiceDescriptorSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  if (seed.dailyCallsPerConsumer > seed.dailyCallsTotal) {
    throw inconsistentDailyCalls();
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

  const updatedEService = replaceDescriptor(eService.data, updatedDescriptor);

  return toCreateEventEServiceUpdated(
    eserviceId,
    eService.metadata.version,
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
}): Array<CreateEvent<EServiceEvent>> {
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
    return [
      deprecateDescriptor(
        eservice.data.id,
        eservice.metadata.version,
        currentActiveDescriptor
      ),
      toCreateEventEServiceDescriptorPublished(
        eserviceId,
        eservice.metadata.version + 1,
        descriptorId,
        newEservice
      ),
    ];
  } else {
    return [
      toCreateEventEServiceDescriptorPublished(
        eserviceId,
        eservice.metadata.version,
        descriptorId,
        newEservice
      ),
    ];
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
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
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
      `Publishing Descriptor ${descriptorId} of EService ${eserviceId}`
    );

    const newEservice: EService = {
      ...eService.data,
      descriptors: eService.data.descriptors.map((d: Descriptor) =>
        d.id === descriptorId ? updatedDescriptor : d
      ),
    };

    return toCreateEventEServiceDescriptorActivated(
      eserviceId,
      eService.metadata.version,
      descriptorId,
      newEservice
    );
  } else {
    return deprecateDescriptor(
      eserviceId,
      eService.metadata.version,
      descriptor
    );
  }
}

export async function cloneDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  copyFile,
  eservice,
  getEServiceByNameAndProducerId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  copyFile: (
    bucket: string,
    docPath: string,
    path: string,
    id: string,
    name: string
  ) => Promise<string>;
  eservice: WithMetadata<EService> | undefined;
  getEServiceByNameAndProducerId: ({
    name,
    producerId,
  }: {
    name: string;
    producerId: TenantId;
  }) => Promise<WithMetadata<EService> | undefined>;
}): Promise<{ eservice: EService; event: CreateEvent<EServiceEvent> }> {
  assertEServiceExist(eserviceId, eservice);
  assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

  const clonedEServiceName = `${
    eservice.data.name
  } - clone - ${formatClonedEServiceDate(new Date())}`;

  if (
    await getEServiceByNameAndProducerId({
      name: clonedEServiceName,
      producerId: authData.organizationId,
    })
  ) {
    throw eServiceDuplicate(clonedEServiceName);
  }

  const descriptor = retrieveDescriptor(descriptorId, eservice);

  const clonedInterfaceId = generateId<EServiceDocumentId>();
  const clonedInterfacePath =
    descriptor.interface !== undefined
      ? await copyFile(
          config.s3Bucket,
          descriptor.interface.path,
          config.eserviceDocumentsPath,
          clonedInterfaceId,
          descriptor.interface.name
        ).catch((error) => {
          logger.error(
            `Error copying interface file for descriptor ${descriptorId} : ${error}`
          );
          throw error;
        })
      : undefined;

  const clonedInterfaceDocument: Document | undefined =
    descriptor.interface !== undefined && clonedInterfacePath !== undefined
      ? {
          id: clonedInterfaceId,
          name: descriptor.interface.name,
          contentType: descriptor.interface.contentType,
          prettyName: descriptor.interface.prettyName,
          path: clonedInterfacePath,
          checksum: descriptor.interface.checksum,
          uploadDate: new Date(),
        }
      : undefined;

  const clonedDocuments = await Promise.all(
    descriptor.docs.map(async (doc: Document) => {
      const clonedDocumentId = generateId<EServiceDocumentId>();
      const clonedDocumentPath = await copyFile(
        config.s3Bucket,
        doc.path,
        config.eserviceDocumentsPath,
        clonedDocumentId,
        doc.name
      );
      const clonedDocument: Document = {
        id: clonedDocumentId,
        name: doc.name,
        contentType: doc.contentType,
        prettyName: doc.prettyName,
        path: clonedDocumentPath,
        checksum: doc.checksum,
        uploadDate: new Date(),
      };
      return clonedDocument;
    })
  ).catch((error) => {
    logger.error(
      `Error copying documents' files for descriptor ${descriptorId} : ${error}`
    );
    throw error;
  });

  const clonedEservice: EService = {
    id: generateId(),
    producerId: eservice.data.producerId,
    name: clonedEServiceName,
    description: eservice.data.description,
    technology: eservice.data.technology,
    attributes: eservice.data.attributes,
    createdAt: new Date(),
    riskAnalysis: eService.data.riskAnalysis,
    mode: eService.data.mode,
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
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);
  const updatedDescriptor = updateDescriptorState(
    descriptor,
    descriptorState.archived
  );

  const newEservice: EService = {
    ...eService.data,
    descriptors: eService.data.descriptors.map((d: Descriptor) =>
      d.id === descriptorId ? updatedDescriptor : d
    ),
  };

  return toCreateEventEServiceDescriptorActivated(
    eserviceId,
    eService.metadata.version,
    descriptorId,
    newEservice
  );
}

export function updateDescriptorLogic({
  eserviceId,
  descriptorId,
  seed,
  authData,
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  seed: UpdateEServiceDescriptorQuotasSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (
    descriptor.state !== descriptorState.published &&
    descriptor.state !== descriptorState.suspended &&
    descriptor.state !== descriptorState.deprecated
  ) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  assertDailyCallsAreConsistentAndNotDecreased({
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    updatedDailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    updatedDailyCallsTotal: seed.dailyCallsTotal,
  });

  const updatedDescriptor: Descriptor = {
    ...descriptor,
    voucherLifespan: seed.voucherLifespan,
    dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
    dailyCallsTotal: seed.dailyCallsTotal,
  };

  const updatedEService = replaceDescriptor(eService.data, updatedDescriptor);

  return toCreateEventEServiceUpdated(
    eserviceId,
    eService.metadata.version,
    updatedEService
  );
}

const isUserAllowedToSeeDraft = (
  authData: AuthData,
  producerId: TenantId
): boolean =>
  hasPermission([userRoles.ADMIN_ROLE, userRoles.API_ROLE], authData) &&
  authData.organizationId === producerId;

const applyVisibilityToEService = (
  eservice: EService,
  authData: AuthData
): EService => {
  if (isUserAllowedToSeeDraft(authData, eservice.producerId)) {
    return eservice;
  }

  if (
    eservice.descriptors.length === 0 ||
    (eservice.descriptors.length === 1 &&
      eservice.descriptors[0].state === descriptorState.draft)
  ) {
    throw eServiceNotFound(eservice.id);
  }

  return {
    ...eservice,
    descriptors: eservice.descriptors.filter(
      (d) => d.state !== descriptorState.draft
    ),
  };
};

function assertDailyCallsAreConsistentAndNotDecreased({
  dailyCallsPerConsumer,
  dailyCallsTotal,
  updatedDailyCallsPerConsumer,
  updatedDailyCallsTotal,
}: {
  dailyCallsPerConsumer: number;
  dailyCallsTotal: number;
  updatedDailyCallsPerConsumer: number;
  updatedDailyCallsTotal: number;
}): void {
  if (updatedDailyCallsPerConsumer > updatedDailyCallsTotal) {
    throw inconsistentDailyCalls();
  }
  if (
    updatedDailyCallsPerConsumer < dailyCallsPerConsumer ||
    updatedDailyCallsTotal < dailyCallsTotal
  ) {
    throw dailyCallsCannotBeDecreased();
  }
}

function replaceDescriptor(
  eservice: EService,
  updatedDescriptor: Descriptor
): EService {
  return {
    ...eservice,
    descriptors: eservice.descriptors.map((descriptor) =>
      descriptor.id === updatedDescriptor.id ? updatedDescriptor : descriptor
    ),
  };
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
