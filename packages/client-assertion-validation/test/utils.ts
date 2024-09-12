import crypto from "crypto";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import * as jwt from "jsonwebtoken";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { ApiKey, ClientAssertionHeader, ConsumerKey } from ".././src/types.js";

export const value64chars = crypto.randomBytes(32).toString("hex");

export const getMockClientAssertion = ({
  customHeader,
  payload,
  customClaims,
  keySet,
}: {
  customHeader: Partial<ClientAssertionHeader>;
  payload: Partial<jwt.JwtPayload>;
  customClaims: { [k: string]: unknown };
  keySet?: crypto.KeyPairKeyObjectResult;
}): string => {
  const clientId = generateId<ClientId>();
  const defaultPayload: jwt.JwtPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it"],
    exp: 60,
    jti: generateId(),
    iat: 5,
    digest: {
      alg: "SHA256",
      value: value64chars,
    },
  };

  const actualPayload = {
    ...defaultPayload,
    ...payload,
    ...customClaims,
  };
  const options: jwt.SignOptions = {
    header: {
      kid: "TODO",
      alg: "RS256",
      ...customHeader,
    },
  };

  if (!keySet) {
    const keySet = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    return jwt.sign(actualPayload, keySet.privateKey, options);
  }

  return jwt.sign(actualPayload, keySet.privateKey, options);
};

export const getMockConsumerKey = (): ConsumerKey => ({
  GSIPK_clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kidWithPurposeId: "",
  publicKey: "TODO",
  algorithm: "RS256",
  clientKind: clientKindTokenStates.consumer,
  GSIPK_purposeId: generateId<PurposeId>(),
  purposeState: itemState.active,
  agreementId: generateId(),
  agreementState: itemState.active,
  eServiceId: generateId(),
  descriptorState: itemState.active,
});

export const getMockApiKey = (): ApiKey => ({
  GSIPK_clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kidWithPurposeId: "",
  publicKey: "TODO",
  algorithm: "RS256",
  clientKind: clientKindTokenStates.api,
});

export const getMockAccessTokenRequest =
  (): authorizationServerApi.AccessTokenRequest => {
    const keySet = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    return {
      client_id: generateId<ClientId>(),
      // TODO: change to env variable
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {},
        keySet,
      }),
      grant_type: "client_credentials",
    };
  };
