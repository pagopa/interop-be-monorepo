import { AuthData, logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import {
  CatalogProcessError,
  ErrorTypes,
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  notValidDescriptor,
  operationForbidden,
} from "../model/domain/errors.js";
import {
  EService,
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorSeed,
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
import { readModelGateway } from "./ReadModelGateway.js";

const assertRequesterAllowed = (
  producerId: string,
  requesterId: string
): void => {
  if (producerId !== requesterId) {
    throw operationForbidden;
  }
};

const retrieveEService = async (eServiceId: string): Promise<EService> => {
  const eService = await readModelGateway.getEServiceById(eServiceId);
  if (eService === undefined) {
    throw eServiceNotFound(eServiceId);
  }
  return eService;
};

const hasNotDraftDescriptor = (eService: EService): boolean => {
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

    const eService = await readModelGateway.getEServiceByName(
      eServiceSeed.name
    );

    if (eService !== undefined) {
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
    assertRequesterAllowed(eService.producerId, authData.organizationId);

    if (
      !(
        eService.descriptors.length === 0 ||
        (eService.descriptors.length === 1 &&
          eService.descriptors[0].state === "DRAFT")
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
      version: eService.version,
      type: "EServiceUpdated",
      data: updatedEServiceSeed,
    });
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eService = await readModelGateway.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eService.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.version,
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
    const eService = await readModelGateway.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.descriptors.find((d) => d.id === descriptorId);
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
    const eService = await readModelGateway.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const document = await readModelGateway.getEServiceDescriptorDocumentById(
      documentId
    );

    if (document === undefined) {
      throw new CatalogProcessError(
        `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
        ErrorTypes.EServiceDocumentNotFound
      );
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
    const eService = await readModelGateway.getEServiceById(eServiceId);

    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.descriptors.find((d) => d.id === descriptorId);
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
      throw new CatalogProcessError(
        `Document with id ${documentId} not found in EService ${eServiceId} / Descriptor ${descriptorId}`,
        ErrorTypes.EServiceDocumentNotFound
      );
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
    assertRequesterAllowed(eService.producerId, authData.organizationId);
    hasNotDraftDescriptor(eService);

    const newVersion = nextDescriptorVersion(eService);
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
    assertRequesterAllowed(eService.producerId, authData.organizationId);

    const descriptor = eService.descriptors.find(
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
      version: eService.version,
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
    const eService = await readModelGateway.getEServiceById(eServiceId);
    if (eService === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eService.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eService.descriptors.find((d) => d.id === descriptorId);
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

    const filteredDescriptor = eService.descriptors.filter(
      (d) => d.id !== descriptorId
    );

    const updatedEService = {
      ...eService,
      descriptor: [...filteredDescriptor, updatedDescriptor],
    };

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eService.version,
      type: "UpdateDraftDescriptor",
      data: updatedEService,
    });
  },
};
