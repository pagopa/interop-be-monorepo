import crypto from "crypto";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import * as jwt from "jsonwebtoken";
import {
  ClientId,
  generateId,
  itemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { ClientAssertionHeader, ConsumerKey } from ".././src/types";

export const getMockClientAssertion = ({
  customHeader,
  payload,
  customClaims,
}: {
  customHeader: Partial<ClientAssertionHeader>;
  payload: Partial<jwt.JwtPayload>;
  customClaims: { [k: string]: unknown };
}): string => {
  const clientId = generateId<ClientId>();
  const defaultPayload: jwt.JwtPayload = {
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
      kid: "todo",
      alg: "RS256",
      ...customHeader,
    },
  };
  return jwt.sign(actualPayload, keySet.privateKey, options);
};

export const getMockConsumerKey = (): ConsumerKey => ({
  GSIPK_clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kidWithPurposeId: "",
  publicKey: "todo",
  algorithm: "RS256",
  clientKind: "Consumer",
  GSIPK_purposeId: generateId<PurposeId>(),
  purposeState: itemState.active,
  agreementId: generateId(),
  agreementState: itemState.active,
  eServiceId: generateId(),
  descriptorState: itemState.active,
});

export const getMockAccessTokenRequest =
  (): authorizationServerApi.AccessTokenRequest => ({
    client_id: generateId<ClientId>(),
    // TODO: change to env variable
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: getMockClientAssertion({
      customHeader: {},
      payload: {},
      customClaims: {},
    }),
    grant_type: "client_credentials",
  });
