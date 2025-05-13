import * as delegationApi from "./generated/delegationApi.js";
import { QueryParametersByAlias } from "./utils.js";

type DelegationApi = typeof delegationApi.delegationApi.api;

export type GetDelegationsQueryParams = QueryParametersByAlias<
  DelegationApi,
  "getDelegations"
>;

export * from "./generated/delegationApi.js";
