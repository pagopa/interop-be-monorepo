import { authorizationApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";

type PagoPAInteropBeClients = {
  authorizationClient: Pick<
    authorizationApi.AuthorizationProcessClient,
    "client"
  >;
};

export function getInteropBeClients(): PagoPAInteropBeClients {
  return {
    authorizationClient: {
      client: authorizationApi.createClientApiClient(config.authorizationUrl),
    },
  };
}
