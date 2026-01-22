import { authorizationApi } from "pagopa-interop-api-clients";

export const authorizationProcessClientBuilder = (
  url: string
): authorizationApi.AuthorizationProcessClient => ({
  client: authorizationApi.createClientApiClient(url),
  key: authorizationApi.createKeyApiClient(url),
  producerKeychain: authorizationApi.createProducerKeychainApiClient(url),
  user: authorizationApi.createUserApiClient(url),
  token: authorizationApi.createTokenGenerationApiClient(url),
});
