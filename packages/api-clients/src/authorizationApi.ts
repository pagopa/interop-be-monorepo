import * as authorizationApi from "./generated/authorizationApi.js";
import { QueryParametersByAlias } from "./utils.js";

type ClientApi = typeof authorizationApi.clientApi.api;
type ProducerKeychainApi = typeof authorizationApi.producerKeychainApi.api;

export type GetClientsQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClients"
>;

export type GetProducerKeychainsQueryParams = QueryParametersByAlias<
  ProducerKeychainApi,
  "getProducerKeychains"
>;

export * from "./generated/authorizationApi.js";
