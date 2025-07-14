import * as authorizationApi from "./generated/authorizationApi.js";
import { QueryParametersByAlias } from "./utils.js";

type ClientApi = typeof authorizationApi.clientApi.api;

export type GetClientsQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClients"
>;

export * from "./generated/authorizationApi.js";
