import { authorizationApi } from "pagopa-interop-api-clients";

export type AuthorizationProcessClient = {
  client: ReturnType<typeof authorizationApi.createClientApiClient>;
};

export const authorizationProcessClientBuilder = (
  url: string
): AuthorizationProcessClient => ({
  client: authorizationApi.createClientApiClient(url),
});
