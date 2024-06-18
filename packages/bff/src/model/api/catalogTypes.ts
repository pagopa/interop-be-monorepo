import { ZodiosResponseByPath, ZodiosQueryParamsByPath } from "@zodios/core";
import { z } from "zod";
import { api as catalog, schemas } from "../generated/catalog-process/api.js";

export type CatalogProcessClientApi = typeof catalog.api;
export type EServicesCatalogProcessApiResponse = ZodiosResponseByPath<
  CatalogProcessClientApi,
  "get",
  "/eservices"
>;

export type CatalogProcessApiQueryParam = ZodiosQueryParamsByPath<
  CatalogProcessClientApi,
  "get",
  "/eservices"
>;

export type EServiceCatalogProcessApi = z.infer<typeof schemas.EService>;

export type EServiceCatalogProcessApiDescriptor = z.infer<
  typeof schemas.EServiceDescriptor
>;

export type EServiceCatalogProcessApiDescriptorState = z.infer<
  typeof schemas.EServiceDescriptorState
>;

export const descriptorApiState: {
  [key: string]: EServiceCatalogProcessApiDescriptorState;
} = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DEPRECATED: "DEPRECATED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;

export type EServiceCatalogProcessApiAttributeCertified = z.infer<
  typeof schemas.Attribute
>;
