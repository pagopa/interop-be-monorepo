import { decode } from "jsonwebtoken";
import { logger } from "../index.js";
import { AuthData, AuthJWTToken } from "./authData.js";

export const readAuthDataFromJwtToken = (
  jwtToken: string
): AuthData | Error => {
  const decoded = decode(jwtToken, { json: true });
  const token = AuthJWTToken.safeParse(decoded);

  if (token.success === false) {
    logger.error(`Error parsing token: ${JSON.stringify(token.error)}`);
    return new Error(token.error.message);
  } else {
    return {
      organizationId: token.data.organizationId,
      userId: token.data.sub,
      userRoles: token.data["user-roles"].split(","),
    };
  }
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.filter((role: string) => permissions.includes(role))
    .length > 0;
