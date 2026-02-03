import {
  m2mGatewayApiV3,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";

export function toM2MGatewayApiUser(
  user: selfcareV2ClientApi.UserResource
): m2mGatewayApiV3.User {
  return {
    userId: user.id,
    name: user.name,
    familyName: user.surname,
    roles: user.roles ?? [],
  };
}
