import { authorizationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
};

type PagoPAInteropBeClients = {
  authorizationClient: AuthorizationProcessClient;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationUrl),
    },
  };
}
