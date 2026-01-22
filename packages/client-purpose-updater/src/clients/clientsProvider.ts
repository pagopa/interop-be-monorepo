import { authorizationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type PagoPAInteropBeClients = {
  authorizationClient: authorizationApi.AuthorizationProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationUrl),
      key: authorizationApi.createKeyApiClient(config.authorizationUrl),
      producerKeychain: authorizationApi.createProducerKeychainApiClient(
        config.authorizationUrl
      ),
      user: authorizationApi.createUserApiClient(config.authorizationUrl),
      token: authorizationApi.createTokenGenerationApiClient(
        config.authorizationUrl
      ),
    },
  };
}
