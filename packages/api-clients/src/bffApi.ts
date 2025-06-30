import * as bffApi from "./generated/bffApi.js";
import { QueryParametersByAlias } from "./utils.js";

type BffEservicesApi = typeof bffApi.eservicesApi.api;
type BffConsumerDelegationApi = typeof bffApi.consumerDelegationsApi.api;

export type BffGetCatalogQueryParam = QueryParametersByAlias<
  BffEservicesApi,
  "getEServicesCatalog"
>;

export type BffGetProducersEservicesQueryParam = QueryParametersByAlias<
  BffEservicesApi,
  "getProducerEServices"
>;

export type BffGetConsumerDelegatorsQueryParam = QueryParametersByAlias<
  BffConsumerDelegationApi,
  "getConsumerDelegators"
>;

export type BffgetConsumerDelegatedEservicesQueryParam = QueryParametersByAlias<
  BffConsumerDelegationApi,
  "getConsumerDelegatedEservices"
>;
export * from "./generated/bffApi.js";
