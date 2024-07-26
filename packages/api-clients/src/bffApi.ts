import * as bffApi from "./generated/bffApi.js";
import { QueryParametersByAlias } from "./utils.js";

type BffApi = typeof bffApi.eservicesApi.api;

export type GetCatalogQueryParam = QueryParametersByAlias<
  BffApi,
  "getEServicesCatalog"
>;

export * from "./generated/bffApi.js";
