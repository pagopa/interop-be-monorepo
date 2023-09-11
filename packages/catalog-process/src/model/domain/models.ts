/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import {
  DescriptorState,
  PersistentAgreementState,
} from "pagopa-interop-models";
import * as api from "../generated/api.js";
import { ApiEServiceDescriptorDocumentSeed } from "../types.js";

export type ListResult<T> = { results: T[]; totalCount: number };
export const emptyListResult = { results: [], totalCount: 0 };

export type WithMetadata<T> = { data: T; metadata: { version: number } };

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

export type ApiTechnology = z.infer<typeof api.schemas.EServiceTechnology>;
export type ApiEServiceDescriptorState = z.infer<
  typeof api.schemas.EServiceDescriptorState
>;
export type ApiAgreementApprovalPolicy = z.infer<
  typeof api.schemas.AgreementApprovalPolicy
>;
export type ApiAgreementState = z.infer<typeof api.schemas.AgreementState>;

export type ApiAttribute = z.infer<typeof api.schemas.Attribute>;

export type EServiceDescriptor = z.infer<typeof api.schemas.EServiceDescriptor>;

export type UpdateEServiceDescriptorSeed = z.infer<
  typeof api.schemas.UpdateEServiceDescriptorSeed
>;

export const consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState: DescriptorState,
  agreementState: PersistentAgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof consumer>;

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
