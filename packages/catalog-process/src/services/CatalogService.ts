import {
  CatalogProcessError,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceNotFound,
  operationForbidden,
  ErrorTypes,
} from "../model/domain/errors.js";
import { AuthData } from "../auth/authData.js";
import { convertToClientEServiceSeed } from "../model/domain/models.js";
import {
  ApiEServiceSeed,
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceDescriptorDocumentUpdateSeed,
} from "../model/types.js";
import {
  eserviceDescriptorDocumentSeedToCreateEvent,
  eserviceSeedToCreateEvent,
} from "../repositories/adapters/adapters.js";
import { eventRepository } from "../repositories/events.js";
import { fileManager } from "../utilities/fileManager.js";
import { readModelGateway } from "./ReadModelGateway.js";

export const catalogService = {
  async createEService(
    apiEservicesSeed: ApiEServiceSeed,
    authData: AuthData
  ): Promise<string> {
    const eserviceSeed = convertToClientEServiceSeed(
      apiEservicesSeed,
      authData.organizationId
    );

    const eservice = await readModelGateway.getEServiceByName(
      eserviceSeed.name
    );

    if (eservice !== undefined) {
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
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    if (
      !(
        eservice.descriptors.length === 0 ||
        (eservice.descriptors.length === 1 &&
          eservice.descriptors[0].state === "DRAFT")
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
      version: eservice.version,
      type: "EServiceUpdated",
      data: eserviceSeed,
    });
  },
  async deleteEService(eServiceId: string, authData: AuthData): Promise<void> {
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.descriptors.length > 0) {
      throw eServiceCannotBeDeleted(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    await eventRepository.createEvent({
      streamId: eServiceId,
      version: eservice.version,
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
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
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
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
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
    const eservice = await readModelGateway.getEServiceById(eServiceId);

    if (eservice === undefined) {
      throw eServiceNotFound(eServiceId);
    }

    if (eservice.producerId !== authData.organizationId) {
      throw operationForbidden;
    }

    const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);
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
};
