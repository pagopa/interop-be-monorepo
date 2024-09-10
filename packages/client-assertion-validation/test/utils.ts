import crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { ClientId, generateId } from "pagopa-interop-models";
import { ClientAssertionPayload } from ".././src/types";

export const getMockClientAssertion = ({
  payload,
  customClaims,
}: {
  payload: Partial<ClientAssertionPayload>;
  customClaims: { [k: string]: unknown };
}): string => {
  const clientId = generateId<ClientId>();
  const defaultPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it"],
    exp: 60,
    jti: generateId(),
    iat: 5,
    // ...customClaims, // TO DO: how many custom claims? Examples?
  };

  const actualPayload = {
    ...defaultPayload,
    ...payload,
    ...customClaims,
  };

  const keySet = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const options: jwt.SignOptions = {
    header: {
      kid: generateId(),
      alg: "RS256",
    },
  };
  return jwt.sign(actualPayload, keySet.privateKey, options);
};
