import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  hasPermission,
  initFileManager,
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
  dailyCallsCannotBeDecreased,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

const fileManager = initFileManager(config);

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
            eService: await readModelService.getEServiceByNameAndProducerId({
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
          deleteFile: fileManager.deleteFile,
        })
      );
    },

    async deleteEService(
      eserviceId: EServiceId,
      authData: AuthData
    ): Promise<void> {
      logger.info(`Deleting EService ${eserviceId}`);
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        deleteEserviceLogic({ eserviceId, authData, eService })
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
      const eService = await readModelService.getEServiceById(eserviceId);

      return await repository.createEvent(
        uploadDocumentLogic({
          eserviceId,
          descriptorId,
          document,
          authData,
          eService,
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

      const eService = await readModelService.getEServiceById(eserviceId);
      await repository.createEvent(
        await deleteDraftDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          deleteFile: fileManager.deleteFile,
          eService,
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
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateDescriptorLogic({
          eserviceId,
          descriptorId,
          seed,
          authData,
          eService,
        })
      );
    },

    async updateDescriptorQuotas(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      seed: UpdateEServiceDescriptorQuotasSeed,
      authData: AuthData
    ): Promise<void> {
      logger.info(
        `Updating draft Descriptor ${descriptorId} for EService ${eserviceId}`
      );
      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        updateDescriptorQuotasLogic({
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

      const eService = await readModelService.getEServiceById(eserviceId);

      for (const event of publishDescriptorLogic({
        eserviceId,
        descriptorId,
        authData,
        eService,
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

      const eService = await readModelService.getEServiceById(eserviceId);

      await repository.createEvent(
        suspendDescriptorLogic({
          eserviceId,
          descriptorId,
          authData,
          eService,
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

      const eService = await readModelService.getEServiceById(eserviceId);

      const { eService: draftEService, event } = await cloneDescriptorLogic({
        eserviceId,
        descriptorId,
        authData,
        copyFile: fileManager.copy,
        eService,
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
      await deleteFile(
        config.storageContainer,
        draftDescriptor.interface.path
      ).catch((error) => {
        logger.error(
          `Error deleting interface for descriptor ${draftDescriptor.id} : ${error}`
        );
      });
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
  eService,
}: {
  eserviceId: EServiceId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  if (eService.data.descriptors.length > 0) {
    throw eServiceCannotBeDeleted(eserviceId);
  }

  return toCreateEventEServiceDeleted(eserviceId, eService.metadata.version);
}

export function uploadDocumentLogic({
  eserviceId,
  descriptorId,
  document,
  authData,
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  document: ApiEServiceDescriptorDocumentSeed;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): CreateEvent<EServiceEvent> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptor.id, descriptor.state);
  }

  if (document.kind === "INTERFACE" && descriptor.interface !== undefined) {
    throw interfaceAlreadyExists(descriptor.id);
  }

  return toCreateEventEServiceDocumentAdded(
    eserviceId,
    eService.metadata.version,
    descriptorId,
    {
      newDocument: {
        id: unsafeBrandId(document.documentId),
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
  eserviceId,
  descriptorId,
  documentId,
  authData,
  eService,
  deleteRemoteFile,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  documentId: EServiceDocumentId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
  deleteRemoteFile: (container: string, path: string) => Promise<void>;
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

  await deleteRemoteFile(config.storageContainer, document.path);

  return toCreateEventEServiceDocumentDeleted(
    eserviceId,
    eService.metadata.version,
    descriptorId,
    documentId
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

  return toCreateEventEServiceDocumentUpdated({
    streamId: eserviceId,
    version: eService.metadata.version,
    descriptorId,
    documentId,
    updatedDocument,
    serverUrls: descriptor.serverUrls,
  });
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

  const newDescriptor: Descriptor = {
    id: generateId(),
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

  return toCreateEventEServiceDescriptorAdded(
    eService.data.id,
    eService.metadata.version,
    newDescriptor
  );
}

export async function deleteDraftDescriptorLogic({
  eserviceId,
  descriptorId,
  authData,
  deleteFile,
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  deleteFile: (container: string, path: string) => Promise<void>;
  eService: WithMetadata<EService> | undefined;
}): Promise<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const descriptor = retrieveDescriptor(descriptorId, eService);

  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptor(descriptorId, descriptor.state.toString());
  }

  const descriptorInterface = descriptor.interface;
  if (descriptorInterface !== undefined) {
    await deleteFile(config.storageContainer, descriptorInterface.path).catch(
      (error) => {
        logger.error(
          `Error deleting interface for descriptor ${descriptorId} : ${error}`
        );
      }
    );
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

  const filteredDescriptor = eService.data.descriptors.filter(
    (d: Descriptor) => d.id !== descriptorId
  );

  const updatedEService: EService = {
    ...eService.data,
    descriptors: [...filteredDescriptor, updatedDescriptor],
  };

  return toCreateEventEServiceUpdated(
    eserviceId,
    eService.metadata.version,
    updatedEService
  );
}

export function updateDescriptorQuotasLogic({
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

  const filteredDescriptor = eService.data.descriptors.filter(
    (d: Descriptor) => d.id !== descriptorId
  );

  const updatedEService: EService = {
    ...eService.data,
    descriptors: [...filteredDescriptor, updatedDescriptor],
  };

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
  eService,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  authData: AuthData;
  eService: WithMetadata<EService> | undefined;
}): Array<CreateEvent<EServiceEvent>> {
  assertEServiceExist(eserviceId, eService);
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
        eserviceId,
        eService.metadata.version + 1,
        updatedDescriptor
      ),
    ];
  } else {
    return [
      toCreateEventEServiceDescriptorUpdated(
        eserviceId,
        eService.metadata.version,
        updatedDescriptor
      ),
    ];
  }
}

export function suspendDescriptorLogic({
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
    eserviceId,
    eService.metadata.version,
    updatedDescriptor
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
    return toCreateEventEServiceDescriptorUpdated(
      eserviceId,
      eService.metadata.version,
      updatedDescriptor
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
  eService,
  getEServiceByNameAndProducerId,
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
  eService: WithMetadata<EService> | undefined;
  getEServiceByNameAndProducerId: ({
    name,
    producerId,
  }: {
    name: string;
    producerId: TenantId;
  }) => Promise<WithMetadata<EService> | undefined>;
}): Promise<{ eService: EService; event: CreateEvent<EServiceEvent> }> {
  assertEServiceExist(eserviceId, eService);
  assertRequesterAllowed(eService.data.producerId, authData.organizationId);

  const currentDate = new Date();
  const currentLocalDate = currentDate.toLocaleDateString("it-IT");
  const currentLocalTime = currentDate.toLocaleTimeString("it-IT");
  const clonedEServiceName = `${eService.data.name} - clone - ${currentLocalDate} ${currentLocalTime}`;

  if (
    await getEServiceByNameAndProducerId({
      name: clonedEServiceName,
      producerId: authData.organizationId,
    })
  ) {
    throw eServiceDuplicate(clonedEServiceName);
  }

  const descriptor = retrieveDescriptor(descriptorId, eService);
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

  const draftCatalogItem: EService = {
    id: generateId(),
    producerId: eService.data.producerId,
    name: clonedEServiceName,
    description: eService.data.description,
    technology: eService.data.technology,
    attributes: eService.data.attributes,
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
    eService: draftCatalogItem,
    event: toCreateEventClonedEServiceAdded(draftCatalogItem),
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

  return toCreateEventEServiceDescriptorUpdated(
    eserviceId,
    eService.metadata.version,
    updatedDescriptor
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
  if (dailyCallsPerConsumer > dailyCallsTotal) {
    throw inconsistentDailyCalls();
  }
  if (
    updatedDailyCallsPerConsumer < dailyCallsPerConsumer ||
    updatedDailyCallsTotal < dailyCallsTotal
  ) {
    throw dailyCallsCannotBeDecreased();
  }
}

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;
