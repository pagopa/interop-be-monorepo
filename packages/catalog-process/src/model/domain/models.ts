/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import {
  DescriptorState,
  AgreementState,
  DescriptorId,
  EServiceId,
} from "pagopa-interop-models";
import * as api from "../generated/api.js";
import { ApiEServiceDescriptorDocumentSeed } from "../types.js";

export type ApiCreateEServiceSeed = z.infer<typeof api.schemas.EServiceSeed>;

export type ApiUpdateEServiceSeed = z.infer<
  typeof api.schemas.UpdateEServiceSeed
>;

export type ApiDescriptorSeedForEServiceCreation = z.infer<
  typeof api.schemas.DescriptorSeedForEServiceCreation
>;

export type EServiceDocument = {
  readonly eserviceId: EServiceId;
  readonly descriptorId: DescriptorId;
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

export type CreateEServiceDescriptorSeed = z.infer<
  typeof api.schemas.EServiceDescriptorSeed
>;

export type UpdateEServiceDescriptorSeed = z.infer<
  typeof api.schemas.UpdateEServiceDescriptorSeed
>;

export type EServiceRiskAnalysisSeed = z.infer<
  typeof api.schemas.EServiceRiskAnalysisSeed
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

export type EServiceAttributesSeed = z.infer<typeof api.schemas.AttributesSeed>;

export type UpdateEServiceDescriptorQuotasSeed = z.infer<
  typeof api.schemas.UpdateEServiceDescriptorQuotasSeed
>;

export const consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState: DescriptorState,
  agreementState: AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof consumer>;

export const convertToDocumentEServiceEventData = (
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  apiEServiceDescriptorDocumentSeed: ApiEServiceDescriptorDocumentSeed
): EServiceDocument => ({
  eserviceId,
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

export type ApiEServiceMode = z.infer<typeof api.schemas.EServiceMode>;
