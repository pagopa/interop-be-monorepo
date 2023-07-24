import {
  AuthData,
  logger,
  authorizationManagementServiceMock,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { CatalogItem } from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  CatalogProcessError,
  ErrorTypes,
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  notValidDescriptor,
  operationForbidden,
  eServiceDocumentNotFound,
} from "../model/domain/errors.js";
import {
  EService,
  EServiceDescriptor,
  EServiceDescriptorSeed,
  EServiceDescriptorState,
  UpdateEServiceDescriptorSeed,
  WithMetadata,
  convertToClientEServiceSeed,
} from "../model/domain/models.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
} from "../model/types.js";
import { eventRepository } from "../repositories/EventRepository.js";
import {
  descriptorSeedToCreateEvent,
  eserviceDescriptorDocumentSeedToCreateEvent,
  eserviceSeedToCreateEvent,
} from "../repositories/adapters/adapters.js";
import { fileManager } from "../utilities/fileManager.js";
import { nextDescriptorVersion } from "../utilities/versionGenerator.js";
import { readModelGateway } from "./readModelService.js";

const assertRequesterAllowed = (
  producerId: string,
  requesterId: string
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

const assertDescriptorIsDraft = (
  descriptor: EServiceDescriptor
): EServiceDescriptor => {
  if (descriptor.state !== "DRAFT") {
    throw notValidDescriptor(descriptor.id, descriptor.state.toString());
  }
  return descriptor;
};

const retrieveEService = async (
  eServiceId: string
): Promise<WithMetadata<CatalogItem>> => {
  const eService = await readModelGateway.getCatalogItemById(eServiceId);
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eService;
};

const retrieveDescriptor = async (
  descriptorId: string,
  eService: EService
): Promise<EServiceDescriptor> => {
  const descriptor = eService.descriptors.find(
    (d) => d.id === descriptorId && d.state === "DRAFT"
  );

  if (descriptor === undefined) {
    throw new CatalogProcessError(
      `Descriptor with id ${descriptorId} of EService ${eService.id} not found`,
      ErrorTypes.EServiceDescriptorNotFound
    );
  }

  return descriptor;
};

const updateDescriptorState = (
  descriptor: EServiceDescriptor,
  updateESErviceDescriptorState: EServiceDescriptorState
): EServiceDescriptor => {
  const descriptorStateChanges = [
    descriptor.state,
    updateESErviceDescriptorState.toString(),
  ];

  return match(descriptorStateChanges)
    .with(["DRAFT", "PUBLISHED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      publishedAt: Date.now().toString(),
    }))
    .with(["PUBLISHED", "SUSPENDED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      suspendedAt: Date.now().toString(),
    }))
    .with(["SUSPENDED", "PUBLISHED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      suspendedAt: undefined,
    }))
    .with(["SUSPENDED", "DEPRECATED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      suspendedAt: undefined,
      deprecatedAt: Date.now().toString(),
    }))
    .with(["SUSPENDED", "ARCHIVED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      suspendedAt: undefined,
      archivedAt: Date.now().toString(),
    }))
    .with(["PUBLISHED", "ARCHIVED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      archivedAt: Date.now().toString(),
    }))
    .with(["PUBLISHED", "DEPRECATED"], () => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
      deprecatedAt: Date.now().toString(),
    }))
    .otherwise(() => ({
      ...descriptor,
      state: updateESErviceDescriptorState,
    }));
};

const deprecateDescriptor = async (
  descriptor: EServiceDescriptor,
  eService: EService
): Promise<void> => {
  logger.info(
    `Deprecating Descriptor ${descriptor.id} of EService ${eService.id}`
  );

  const updatedDescriptor = updateDescriptorState(descriptor, "DEPRECATED");
  await eventRepository.createEvent({
    streamId: eService.id,
    version: eService.version,
    type: "DeprecateDescriptor",
    data: updatedDescriptor,
  });
};

const hasNotDraftDescriptor = (eService: CatalogItem): boolean => {
  const hasNotDraftDescriptor = eService.descriptors.some(
    (d) => d.state === "DRAFT",
    0
  );
  if (!hasNotDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eService.id);
  }
  return hasNotDraftDescriptor;
};

export const catalogService = {
  async createEService(
    apiEServicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<string> {
    const eServiceSeed = convertToClientEServiceSeed(
      apiEServicesSeed,
      authData.organizationId
    );

    const eservice = await readModelGateway.getCatalogItems(
      authData,
      {
        eservicesIds: [],
        producersIds: [eServiceSeed.producerId],
        states: [],
        agreementStates: [],
        name: { value: eServiceSeed.name, exactMatch: true },
      },
      0,
      1
    );

    if (eservice.results.length > 0) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eServiceSeed.name}`,
        ErrorTypes.DuplicateEserviceName
      );
    }

    return eventRepository.createEvent(eserviceSeedToCreateEvent(eServiceSeed));
  },
  async updateEService(
    eServiceId: string,
    eServiceSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    if (
      !(
        eService.data.descriptors.length === 0 ||
        (eService.data.descriptors.length === 1 &&
          eService.data.descriptors[0].state === "DRAFT")
      )
    ) {
      throw eServiceCannotBeUpdated(eServiceId);
    }

    const updatedEServiceSeed = convertToClientEServiceSeed(
      eServiceSeed,
      authData.organizationId
    );

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.metadata.version,
      type: "EServiceUpdated",
      data: updatedEServiceSeed,
    });
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eService = await readModelGateway.getCatalogItemById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.metadata.version,
      type: "EServiceDeleted",
      data: {},
    });
  },
  async uploadDocument(
    eServiceId: string,
    descriptorId: string,
    document: ApiEServiceDescriptorDocumentSeed,
    authData: AuthData
  ): Promise<string> {
    const eService = await readModelGateway.getCatalogItemById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    return await eventRepository.createEvent(
      eserviceDescriptorDocumentSeedToCreateEvent(
        eServiceId,
        descriptorId,
        document
      )
    );
  },
  async deleteDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelGateway.getCatalogItemById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const document = await readModelGateway.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
    }

    await fileManager.deleteFile(document.path);

    await eventRepository.createEvent({
      streamId: documentId,
      version: document.version,
      type: "DeleteCatalogItemDocument",
      data: {
        eServiceId,
        descriptorId,
        documentId,
      },
    });
  },
  async updateDocument(
    eServiceId: string,
    descriptorId: string,
    documentId: string,
    apiEServiceDescriptorDocumentUpdateSeed: ApiEServiceDescriptorDocumentUpdateSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelGateway.getCatalogItemById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor ${descriptorId} for EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const document = await readModelGateway.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw eServiceDocumentNotFound(eServiceId, descriptorId, documentId);
    }

    const updatedDocument = {
      ...document,
      prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
    };

    await eventRepository.createEvent({
      streamId: documentId,
      version: document.version,
      type: "UpdateCatalogItemDocument",
      data: {
        eServiceId,
        descriptorId,
        document: updatedDocument,
      },
    });
  },

  async createDescriptor(
    eServiceId: string,
    eserviceDescriptorSeed: EServiceDescriptorSeed,
    authData: AuthData
  ): Promise<string> {
    logger.info(`Creating Descriptor for EService ${eServiceId}`);

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);
    hasNotDraftDescriptor(eService.data);

    const newVersion = nextDescriptorVersion(eService.data);
    const descriptorId = uuidv4();
    const createCatalogDescriptor = descriptorSeedToCreateEvent(
      descriptorId,
      eserviceDescriptorSeed,
      newVersion.toString()
    );

    await eventRepository.createEvent(createCatalogDescriptor);
    return descriptorId;
  },

  async deleteDraftDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Deleting draft Descriptor ${descriptorId} of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = eService.data.descriptors.find(
      (d) => d.id === descriptorId && d.state === "DRAFT"
    );

    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    const interfacePath = descriptor.docs.find(
      (doc) => doc.id === descriptorId
    );
    if (interfacePath !== undefined) {
      await fileManager.deleteFile(interfacePath.path);
    }

    const deleteDescriptorDocs = descriptor.docs.map((doc) =>
      fileManager.deleteFile(doc.path)
    );

    await Promise.all(deleteDescriptorDocs).catch((error) => {
      logger.error(
        `Error deleting documents for descriptor ${descriptorId} : ${error}`
      );
    });

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.metadata.version,
      type: "DeleteDraftDescriptor",
      data: {
        eServiceId,
        descriptorId,
      },
    });
  },

  async updateDescriptor(
    eServiceId: string,
    descriptorId: string,
    seed: UpdateEServiceDescriptorSeed,
    authData: AuthData
  ): Promise<void> {
    const eService = await readModelGateway.getCatalogItemById(eServiceId);
    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.data.descriptors.find(
      (d) => d.id === descriptorId
    );
    if (descriptor === undefined) {
      throw new CatalogProcessError(
        `Descriptor with id ${descriptorId} of EService ${eServiceId} not found`,
        ErrorTypes.EServiceDescriptorNotFound
      );
    }

    if (descriptor.state === "DRAFT") {
      throw notValidDescriptor(descriptorId, descriptor.state.toString());
    }

    const updatedDescriptor = {
      ...descriptor,
      description: seed.description,
      audience: seed.audience,
      voucherLifeSpan: seed.voucherLifespan,
      dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
      state: "DRAFT",
      dailyCallsTotal: seed.dailyCallsTotal,
      agreementApprovalPolicy: seed.agreementApprovalPolicy,
    };

    const filteredDescriptor = eService.data.descriptors.filter(
      (d) => d.id !== descriptorId
    );

    const updatedEService = {
      ...eService,
      descriptor: [...filteredDescriptor, updatedDescriptor],
    };

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.metadata.version,
      type: "UpdateDraftDescriptor",
      data: updatedEService,
    });
  },

  async publishDescriptor(
    eServiceId: string,
    descriptorId: string,
    authData: AuthData
  ): Promise<void> {
    logger.info(
      `Publishing Descriptor $descriptorId of EService ${eServiceId}`
    );

    const eService = await retrieveEService(eServiceId);
    assertRequesterAllowed(eService.data.producerId, authData.organizationId);

    const descriptor = await retrieveDescriptor(descriptorId, eService.data);
    assertDescriptorIsDraft(descriptor);

    const currentActiveDescriptor = eService.data.descriptors.find(
      (d) => d.state === "PUBLISHED"
    ); // Must be at most one

    const updatedDescriptor = updateDescriptorState(descriptor, "PUBLISHED");
    if (currentActiveDescriptor !== undefined) {
      await deprecateDescriptor(currentActiveDescriptor, eService.data);
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.metadata.version,
      type: "PublishDescriptor",
      data: updatedDescriptor,
    });

    authorizationManagementServiceMock.updateStateOnClients();
  },
};
