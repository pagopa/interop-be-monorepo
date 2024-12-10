import * as catalogApi from "./generated/catalogApi.js";
import { QueryParametersByAlias } from "./utils.js";

type CatalogApi = typeof catalogApi.processApi.api;

export type GetEServicesQueryParams = QueryParametersByAlias<
  CatalogApi,
  "getEServices"
>;

export * from "./generated/catalogApi.js";
