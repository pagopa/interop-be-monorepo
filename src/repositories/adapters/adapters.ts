import { v4 as uuidv4 } from "uuid";
import { EServiceSeed } from "../../model/domain/models.js";
import { CreateEvent } from "../events.js";
import { ApiEServiceDescriptorDocumentSeed } from "../../model/types.js";

export const eserviceSeedToCreateEvent = (
  eserviceSeed: EServiceSeed
): CreateEvent<EServiceSeed> => ({
  streamId: uuidv4(),
  version: 0,
  type: "CatalogItemAdded", // TODO: change this value with properly event type definition
  data: eserviceSeed,
});

export const eserviceDescriptorDocumentSeedToCreateEvent = (
  eServiceId: string,
  descriptorId: string,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): CreateEvent<{
  eServiceId: string;
  descriptorId: string;
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed;
}> => ({
  streamId: uuidv4(),
  version: 0,
  type: "DocumentItemAdded", // TODO: change this value with properly event type definition
  data: {
    eServiceId,
    descriptorId,
    apiEServiceDescriptorDocumentSeed,
  },
});
