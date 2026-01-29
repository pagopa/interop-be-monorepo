import * as authorizationApi from "./generated/authorizationApi.js";
import { QueryParametersByAlias } from "./utils.js";

type ClientApi = typeof authorizationApi.clientApi.api;
type ProducerKeychainApi = typeof authorizationApi.producerKeychainApi.api;

export type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
  key: ReturnType<typeof authorizationApi.createKeyApiClient>;
  producerKeychain: ReturnType<
    typeof authorizationApi.createProducerKeychainApiClient
  >;
  user: ReturnType<typeof authorizationApi.createUserApiClient>;
  token: ReturnType<typeof authorizationApi.createTokenGenerationApiClient>;
};

export type GetClientsQueryParams = QueryParametersByAlias<
  ClientApi,
  "getClients"
>;

export type GetProducerKeychainsQueryParams = QueryParametersByAlias<
  ProducerKeychainApi,
  "getProducerKeychains"
>;

export * from "./generated/authorizationApi.js";
