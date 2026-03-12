import * as delegationApi from "./generated/delegationApi.js";
import { QueryParametersByAlias } from "./utils.js";

type DelegationApi = typeof delegationApi.delegationApi.api;

export type DelegationProcessClient = {
  producer: ReturnType<typeof delegationApi.createProducerApiClient>;
  consumer: ReturnType<typeof delegationApi.createConsumerApiClient>;
  delegation: ReturnType<typeof delegationApi.createDelegationApiClient>;
};

export type GetDelegationsQueryParams = QueryParametersByAlias<
  DelegationApi,
  "getDelegations"
>;

export * from "./generated/delegationApi.js";
