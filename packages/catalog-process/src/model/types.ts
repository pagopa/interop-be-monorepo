import { ZodiosBodyByPath } from "@zodios/core";
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
