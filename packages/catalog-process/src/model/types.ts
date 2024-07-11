import { ZodiosBodyByPath } from "@zodios/core";
import {
  AgreementState,
  AttributeId,
  DescriptorState,
  EServiceId,
  EServiceMode,
  TenantId,
} from "pagopa-interop-models";
import { api } from "./generated/api.js";

type Api = typeof api.api;

export type ApiEServiceDescriptorDocumentSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/eservices/:eServiceId/descriptors/:descriptorId/documents"
>;

export type ApiEServiceDescriptorDocumentUpdateSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update"
>;

export type ApiEServiceRiskAnalysisSeed = ZodiosBodyByPath<
  Api,
  "post",
  "/eservices/:eServiceId/riskAnalysis"
>;

export type ApiGetEServicesFilters = {
  eservicesIds: EServiceId[];
  producersIds: TenantId[];
  attributesIds: AttributeId[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
  mode?: EServiceMode;
};
