import { EService } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { apiTechnologyToTechnology } from "../../model/domain/apiConverter.js";
import {
  EServiceDescriptor,
  EServiceDescriptorSeed,
  EServiceDocument,
  EServiceSeed,
  convertToDescriptorEServiceEventData,
  convertToDocumentEServiceEventData,
} from "../../model/domain/models.js";
import { ApiEServiceDescriptorDocumentSeed } from "../../model/types.js";
import { CreateEvent } from "../EventRepository.js";

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<EService> => {
  const id = uuidv4();
  return {
    streamId: id,
    version: 0,
    type: "CatalogItemAdded", // TODO: change this value with properly event type definition
    data: {
      name: eserviceSeed.name,
      description: eserviceSeed.description,
      technology: apiTechnologyToTechnology(eserviceSeed.technology),
      id,
      producerId: eserviceSeed.producerId,
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
