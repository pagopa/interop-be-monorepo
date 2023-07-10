import jwt from "jsonwebtoken";
import { logger } from "pagopa-interop-commons";
import { AuthData, AuthJWTToken } from "./authData.js";

export const readAuthDataFromJwtToken = (
  jwtToken: string
): AuthData | Error => {
  const decoded = jwt.decode(jwtToken, { json: true });
  const token = AuthJWTToken.safeParse(decoded);

  if (!token.success) {
    logger.error(`Error parsing token: ${JSON.stringify(token.error)}`);
    return new Error(token.error.message);
  } else {
    return token.data;
  }
};
