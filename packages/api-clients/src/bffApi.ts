import * as bffApi from "./generated/bffApi.js";
import { QueryParametersByAlias } from "./utils.js";

type BffApi = typeof bffApi.eservicesApi.api;

export type BffGetCatalogQueryParam = QueryParametersByAlias<
  BffApi,
  "getEServicesCatalog"
>;

export type BffGetEserviceByDescriptorIdQueryParam = QueryParametersByAlias<
  BffApi,
  "getProducerEServiceDescriptor"
>;

export * from "./generated/bffApi.js";
