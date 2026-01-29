import {
  m2mGatewayApiV3,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import { match, P } from "ts-pattern";

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

export const toM2MGatewayApiCompactUser = (
  input: selfcareV2ClientApi.UserResponse,
  userId: string
): m2mGatewayApiV3.CompactUser =>
  match(input)
    .with({ name: P.nullish, surname: P.nullish }, () => ({
      userId,
      name: "Utente",
      familyName: userId,
    }))
    .otherwise((ur) => ({
      userId,
      name: ur.name ?? "",
      familyName: ur.surname ?? "",
    }));
