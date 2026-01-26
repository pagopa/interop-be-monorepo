import { authorizationApi } from "pagopa-interop-api-clients";

export const authorizationProcessClientBuilder = (
  url: string
): Pick<authorizationApi.AuthorizationProcessClient, "client"> => ({
  client: authorizationApi.createClientApiClient(url),
});
