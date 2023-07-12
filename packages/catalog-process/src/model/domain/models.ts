/* 
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import * as api from "../generated/api.js";
import {
  ApiEServiceDescriptorDocumentSeed,
  ApiEServiceSeed,
} from "../types.js";

export type EService = z.infer<typeof api.schemas.EService> & {
  version: number;
};

export type EServiceSeed = z.infer<typeof api.schemas.EServiceSeed> & {
  readonly producerId: string;
};

export type EServiceDocument = {
  readonly eServiceId: string;
  readonly descriptorId: string;
  readonly document: {
    readonly name: string;
    readonly contentType: string;
    readonly prettyName: string;
    readonly path: string;
    readonly checksum: string;
    readonly uploadDate: number;
  };
  readonly isInterface: boolean;
  readonly serverUrls: string[];
};

export const convertToClientEServiceSeed = (
  seed: ApiEServiceSeed,
  producerId: string
): EServiceSeed => ({
  ...seed,
  producerId,
});

export const convertToDocumentEServiceEventData = (
  eServiceId: string,
  descriptorId: string,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): EServiceDocument => ({
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
});
