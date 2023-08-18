import { v4 as uuidv4 } from "uuid";
import { CatalogItem, Document } from "pagopa-interop-models";
import {
  EServiceDescriptor,
  EServiceDescriptorSeed,
  EServiceDocument,
  EServiceSeed,
  convertToDescriptorEServiceEventData,
  convertToDocumentEServiceEventData,
} from "../model/domain/models.js";
import { ApiEServiceDescriptorDocumentSeed } from "../model/types.js";
import { CreateEvent, CreateEvent1 } from "./events.js";

const toCatalogItem = (
  streamId: string,
  eServiceSeed: EServiceSeed
): CatalogItem => ({
  id: streamId,
  producerId: eServiceSeed.producerId,
  name: eServiceSeed.name,
  description: eServiceSeed.description,
  technology: eServiceSeed.technology, // TODO map enum case
  attributes: undefined,
  descriptors: [],
  createdAt: new Date(),
});

export const toCreateEventCatalogItemAdded = (
  eServiceSeed: EServiceSeed
): CreateEvent1 => {
  const streamId = uuidv4();
  return {
    streamId,
    version: 0,
    event: {
      type: "CatalogItemAdded",
      data: {
        catalogItem: toCatalogItem(streamId, eServiceSeed),
      },
    },
  };
};

export const toCreateEventCatalogItemDocumentUpdated = (
  streamId: string,
  version: number,
  descriptorId: string,
  documentId: string,
  updatedDocument: Document,
  serverUrls: string[]
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "CatalogItemDocumentUpdated",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
      updatedDocument,
      serverUrls,
    },
  },
});

export const toCreateEventCatalogItemDeleted = (
  streamId: string,
  version: number
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "CatalogItemDeleted",
    data: {
      catalogItemId: streamId,
    },
  },
});

export const toCreateEventCatalogItemDocumentDeleted = (
  streamId: string,
  version: number,
  descriptorId: string,
  documentId: string
): CreateEvent1 => ({
  streamId,
  version,
  event: {
    type: "CatalogItemDocumentDeleted",
    data: {
      eServiceId: streamId,
      descriptorId,
      documentId,
    },
  },
});

// old

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<CatalogItem> => {
  const id = uuidv4();
  return {
    streamId: id,
    version: 0,
    type: "CatalogItemAdded", // TODO: change this value with properly event type definition
    data: {
      ...eserviceSeed,
      id,
      descriptors: [],
      createdAt: new Date(),
    },
  };
};

export const eserviceDescriptorDocumentSeedToCreateEvent = (
  eServiceId: string,
  descriptorId: string,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): CreateEvent<EServiceDocument> => ({
  streamId: uuidv4(),
  version: 0,
  type: "DocumentItemAdded", // TODO: change this value with properly event type definition
  data: convertToDocumentEServiceEventData(
    eServiceId,
    descriptorId,
    apiEServiceDescriptorDocumentSeed
  ),
});

export const descriptorSeedToCreateEvent = (
  descriptorId: string,
  descriptorSeed: EServiceDescriptorSeed,
  descriptorVersion: string
): CreateEvent<EServiceDescriptor> => ({
  streamId: uuidv4(),
  version: 0,
  type: "Descriptor created", // TODO: change this value with properly event type definition
  data: convertToDescriptorEServiceEventData(
    descriptorSeed,
    descriptorId,
    descriptorVersion
  ),
});
