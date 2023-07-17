/* 
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import { attribute, catalogItem } from "models";
import { match } from "ts-pattern";
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

export type EServiceDescriptorSeed = z.infer<
  typeof api.schemas.EServiceDescriptorSeed
>;

export type EServiceDescriptorState = z.infer<
  typeof api.schemas.EServiceDescriptorState
>;

export type EServiceDescriptor = z.infer<typeof api.schemas.EServiceDescriptor>;

export type UpdateEServiceDescriptorSeed = z.infer<
  typeof api.schemas.UpdateEServiceDescriptorSeed
>;

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

export const convertToDescriptorEServiceEventData = (
  eserviceDescriptorSeed: EServiceDescriptorSeed,
  descriptorId: string,
  version: string
): EServiceDescriptor => ({
  id: descriptorId,
  description: eserviceDescriptorSeed.description,
  version,
  interface: undefined,
  docs: [],
  state: "DRAFT",
  voucherLifespan: eserviceDescriptorSeed.voucherLifespan,
  audience: eserviceDescriptorSeed.audience,
  dailyCallsPerConsumer: eserviceDescriptorSeed.dailyCallsPerConsumer,
  dailyCallsTotal: eserviceDescriptorSeed.dailyCallsTotal,
  agreementApprovalPolicy: eserviceDescriptorSeed.agreementApprovalPolicy,
  serverUrls: [],
  publishedAt: undefined,
  suspendedAt: undefined,
  deprecatedAt: undefined,
  archivedAt: undefined,
  attributes: eserviceDescriptorSeed.attributes,
});

export const convertCatalogToEService = (
  catalog: z.infer<typeof catalogItem>
): z.infer<typeof api.schemas.EService> => {
  const mapAttribute = (a: z.infer<typeof attribute>) =>
    match(a)
      .with({ type: "SingleAttribute" }, (a) => ({
        single: a.id,
      }))
      .with({ type: "GroupAttribute" }, (a) => ({
        group: a.ids,
      }))
      .exhaustive();

  return {
    id: catalog.id,
    producerId: catalog.producerId,
    name: catalog.name,
    description: catalog.description,
    technology: catalog.technology,
    descriptors: catalog.descriptors.map((descriptor) => ({
      id: descriptor.id,
      version: descriptor.version,
      description: descriptor.description,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      interface: descriptor.interface,
      docs: descriptor.docs,
      state: descriptor.state,
      agreementApprovalPolicy:
        descriptor.agreementApprovalPolicy ?? "AUTOMATIC",
      serverUrls: descriptor.serverUrls,
      publishedAt: descriptor.publishedAt,
      suspendedAt: descriptor.suspendedAt,
      deprecatedAt: descriptor.deprecatedAt,
      archivedAt: descriptor.archivedAt,
      attributes: {
        certified: descriptor.attributes.certified.map(mapAttribute),
        declared: descriptor.attributes.declared.map(mapAttribute),
        verified: descriptor.attributes.verified.map(mapAttribute),
      },
    })),
  };
};
