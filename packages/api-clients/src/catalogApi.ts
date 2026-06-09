import * as catalogApi from "./generated/catalogApi.js";
import { ZodiosInstance } from "@zodios/core";
import { QueryParametersByAlias } from "./utils.js";

type CatalogApi = typeof catalogApi.processEndpoints;

export type CatalogProcessClient = ZodiosInstance<
  typeof catalogApi.processEndpoints
>;

export type GetEServicesQueryParams = QueryParametersByAlias<
  CatalogApi,
  "getEServices"
>;

export type GetEServiceDocumentsQueryParams = QueryParametersByAlias<
  CatalogApi,
  "getEServiceDocuments"
>;

export * from "./generated/catalogApi.js";
