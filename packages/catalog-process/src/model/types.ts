import { ZodiosBodyByPath } from "@zodios/core";
import { AgreementState, DescriptorState } from "pagopa-interop-models";
import { api } from "./generated/api.js";

type Api = typeof api.api;
export type ApiEServiceSeed = ZodiosBodyByPath<Api, "post", "/eservices">;

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

export type ApiGetEServicesFilters = {
  eservicesIds: string[];
  producersIds: string[];
  states: DescriptorState[];
  agreementStates: AgreementState[];
  name?: string;
};
