import { ZodiosQueryParamsByPath } from "@zodios/core";
import { z } from "zod";
import { api as catalog, schemas } from "../generated/catalog-process/api.js";

export type CatalogProcessClientApi = typeof catalog.api;

export type CatalogProcessApiQueryParam = ZodiosQueryParamsByPath<
  CatalogProcessClientApi,
  "get",
  "/eservices"
>;

export type CatalogProcessApiEService = z.infer<typeof schemas.EService>;
export type CatalogProcessApiDescriptor = z.infer<
  typeof schemas.EServiceDescriptor
>;
export type CatalogProcessApiDescriptorState = z.infer<
  typeof schemas.EServiceDescriptorState
>;
export const descriptorApiState: {
  [key: string]: CatalogProcessApiDescriptorState;
} = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  DEPRECATED: "DEPRECATED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;
export type CatalogProcessApiAttribute = z.infer<typeof schemas.Attribute>;
