import jwt from "jsonwebtoken";
import { logger } from "../utilities/logger.js";
import { AuthData, AuthJWTToken } from "./authData.js";

export const readClaimsFromJwtToken = (jwtToken: string): AuthData | null => {
  const decoded = jwt.decode(jwtToken, { json: true });
  const token = AuthJWTToken.safeParse(decoded);

  if (!token.success) {
    logger.error(`Error parsing token: ${JSON.stringify(token.error)}`);
    return null;
  } else {
    return token.data;
  }
};
