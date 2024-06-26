import { ZodiosQueryParamsByPath, ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import { api as catalog, schemas } from "../generated/catalog-process/api.js";

export type CatalogProcessClientApi = typeof catalog.api;
export type CatalogProcessApiEServicesResponse = ZodiosResponseByPath<
  CatalogProcessClientApi,
  "get",
  "/eservices"
>;

export type CatalogProcessApiQueryParam = ZodiosQueryParamsByPath<
  CatalogProcessClientApi,
  "get",
  "/eservices"
>;

export type CatalogProcessApiEService = z.infer<typeof schemas.EService>;

export type CatalogProcessApiEServiceDescriptor = z.infer<
  typeof schemas.EServiceDescriptor
>;

export type CatalogProcessApiEServiceDescriptorState = z.infer<
  typeof schemas.EServiceDescriptorState
>;

export const descriptorApiState: {
  [key: string]: CatalogProcessApiEServiceDescriptorState;
} = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DEPRECATED: "DEPRECATED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;

export type CatalogProcessApiEServiceAttributeCertified = z.infer<
  typeof schemas.Attribute
>;
