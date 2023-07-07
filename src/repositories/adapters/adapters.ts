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
  document: {
    name: string;
    contentType: string;
    prettyName: string;
    path: string;
    checksum: string;
    uploadDate: number;
  };
  isInterface: boolean;
  serverUrls: string[];
}> => ({
  streamId: uuidv4(),
  version: 0,
  type: "DocumentItemAdded", // TODO: change this value with properly event type definition
  data: {
    eServiceId,
    descriptorId,
    document: {
      name: apiEServiceDescriptorDocumentSeed.fileName,
      contentType: apiEServiceDescriptorDocumentSeed.contentType,
      prettyName: apiEServiceDescriptorDocumentSeed.prettyName,
      path: apiEServiceDescriptorDocumentSeed.filePath,
      checksum: apiEServiceDescriptorDocumentSeed.checksum,
      uploadDate: Date.now(),
    },
    isInterface: apiEServiceDescriptorDocumentSeed.kind === "INTERFACE",
    serverUrls: apiEServiceDescriptorDocumentSeed.serverUrls,
  },
});
