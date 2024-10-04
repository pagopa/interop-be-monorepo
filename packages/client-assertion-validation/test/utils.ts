import crypto from "crypto";
import * as jwt from "jsonwebtoken";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import {
  ApiKey,
  ClientAssertionHeader,
  ClientAssertionValidationRequest,
  ConsumerKey,
} from ".././src/types.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "../src/utils.js";

export const value64chars = crypto.randomBytes(32).toString("hex");

export const getMockClientAssertion = ({
  customHeader,
  standardClaimsOverride,
  customClaims,
  keySet,
}: {
  customHeader: Partial<ClientAssertionHeader>;
  standardClaimsOverride: Partial<jwt.JwtPayload>;
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
  };

  const actualPayload = {
    ...defaultPayload,
    ...standardClaimsOverride,
    ...customClaims,
  };
  const options: jwt.SignOptions = {
    header: {
      kid: "kid",
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
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "kid",
  purposeId: generateId<PurposeId>(),
  publicKey: crypto
    .generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    .publicKey.export({ type: "pkcs1", format: "pem" })
    .toString("base64url"),
  algorithm: "RS256",
  clientKind: clientKindTokenStates.consumer,
  purposeState: itemState.active,
  agreementId: generateId(),
  agreementState: itemState.active,
  eServiceId: generateId(),
  descriptorState: itemState.active,
});

export const getMockApiKey = (): ApiKey => ({
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "kid",
  purposeId: generateId<PurposeId>(),
  publicKey: crypto
    .generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    .publicKey.export({ type: "pkcs1", format: "pem" })
    .toString("base64url"),
  algorithm: "RS256",
  clientKind: clientKindTokenStates.api,
});

export const getMockAccessTokenRequest =
  (): ClientAssertionValidationRequest => {
    const keySet = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    return {
      client_id: generateId<ClientId>(),
      client_assertion_type: EXPECTED_CLIENT_ASSERTION_TYPE,
      client_assertion: getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
        keySet,
      }),
      grant_type: EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
    };
  };
