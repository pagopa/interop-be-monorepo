import { logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { AuthData } from "pagopa-interop-commons";
import { CatalogItem } from "pagopa-interop-models";
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
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
  WithMetadata,
  convertToClientEServiceSeed,
} from "../model/domain/models.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
  ApiEServiceSeed,
} from "../model/types.js";
import {
  descriptorSeedToCreateEvent,
  eserviceDescriptorDocumentSeedToCreateEvent,
  eserviceSeedToCreateEvent,
} from "../repositories/adapters/adapters.js";
import { eventRepository } from "../repositories/events.js";
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

const retrieveEService = async (
  eServiceId: string
): Promise<WithMetadata<CatalogItem>> => {
  const eservice = await readModelGateway.getCatalogItemById(eServiceId);
  if (eservice === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eservice;
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
    apiEservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<string> {
    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      authData.organizationId
    );

    const eservice = await readModelGateway.getCatalogItems(
      authData,
      {
        eservicesIds: [],
        producersIds: [eserviceSeed.producerId],
        states: [],
        agreementStates: [],
        name: { value: eserviceSeed.name, exactMatch: true },
      },
      0,
      1
    );

    if (eservice.results.length > 0) {
      throw new CatalogProcessError(
        `Error during EService creation with name ${eserviceSeed.name}`,
        ErrorTypes.DuplicateEserviceName
      );
    }

    return eventRepository.createEvent(eserviceSeedToCreateEvent(eserviceSeed));
  },
  async updateEService(
    eServiceId: string,
    eservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<void> {
    const eservice = await retrieveEService(eServiceId);
    assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

    if (
      !(
        eservice.data.descriptors.length === 0 ||
        (eservice.data.descriptors.length === 1 &&
          eservice.data.descriptors[0].state === "DRAFT")
      )
    ) {
      throw eServiceCannotBeUpdated(eServiceId);
    }

    const eserviceSeed = convertToClientEServiceSeed(
      eservicesSeed,
      authData.organizationId
    );

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.metadata.version,
      type: "EServiceUpdated",
      data: eserviceSeed,
    });
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eservice = await readModelGateway.getCatalogItemById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.data.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eservice.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.metadata.version,
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
    const eservice = await readModelGateway.getCatalogItemById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.data.descriptors.find(
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
    const eservice = await readModelGateway.getCatalogItemById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.data.producerId !== authData.organizationId) {
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
    const eservice = await readModelGateway.getCatalogItemById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.data.descriptors.find(
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

    const eservice = await retrieveEService(eServiceId);
    assertRequesterAllowed(eservice.data.producerId, authData.organizationId);
    hasNotDraftDescriptor(eservice.data);

    const newVersion = nextDescriptorVersion(eservice.data);
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

    const eservice = await retrieveEService(eServiceId);
    assertRequesterAllowed(eservice.data.producerId, authData.organizationId);

    const descriptor = eservice.data.descriptors.find(
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
      version: eservice.metadata.version,
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
    const eservice = await readModelGateway.getCatalogItemById(eServiceId);
    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.data.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.data.descriptors.find(
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

    const filteredDescriptor = eservice.data.descriptors.filter(
      (d) => d.id !== descriptorId
    );

    const updatedEService = {
      ...eservice,
      descriptor: [...filteredDescriptor, updatedDescriptor],
    };

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.metadata.version,
      type: "UpdateDraftDescriptor",
      data: updatedEService,
    });
  },
};
