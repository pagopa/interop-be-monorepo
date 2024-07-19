import { authorizationManagementApi } from "pagopa-interop-api-clients";

export type AuthorizationManagementPurposeApiClient = ReturnType<
  typeof authorizationManagementApi.createPurposeApiClient
>;

export type AuthorizationManagementKeyApiClient = ReturnType<
  typeof authorizationManagementApi.createKeyApiClient
>;

export type AuthorizationManagementClientApiClient = ReturnType<
  typeof authorizationManagementApi.createClientApiClient
>;

export type AuthorizationManagementClients = {
  purposeApiClient: AuthorizationManagementPurposeApiClient;
  keyApiClient: AuthorizationManagementKeyApiClient;
  clientApiClient: AuthorizationManagementClientApiClient;
};

export function buildAuthorizationManagementClients(
  authorizationManagementUrl: string
): AuthorizationManagementClients {
  return {
    purposeApiClient: authorizationManagementApi.createPurposeApiClient(
      authorizationManagementUrl
    ),
    keyApiClient: authorizationManagementApi.createKeyApiClient(
      authorizationManagementUrl
    ),
    clientApiClient: authorizationManagementApi.createClientApiClient(
      authorizationManagementUrl
    ),
  };
}
