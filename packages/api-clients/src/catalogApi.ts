import * as catalogApi from "./generated/catalogApi.js";
import { QueryParametersByAlias } from "./utils.js";

type CatalogApi = typeof catalogApi.processApi.api;

export type CatalogProcessClient = ReturnType<
  typeof catalogApi.createProcessApiClient
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
