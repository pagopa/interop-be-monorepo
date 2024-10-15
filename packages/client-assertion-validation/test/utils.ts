import crypto from "crypto";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { importPKCS8, JWTHeaderParameters, JWTPayload, SignJWT } from "jose";
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

export const getMockClientAssertion = async ({
  customHeader,
  standardClaimsOverride,
  customClaims,
  keySet: maybeKeySet,
}: {
  customHeader: Partial<ClientAssertionHeader>;
  standardClaimsOverride: Partial<JWTPayload>;
  customClaims: { [k: string]: unknown };
  keySet?: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const keySet: crypto.KeyPairKeyObjectResult =
    maybeKeySet ??
    crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
  const clientId = generateId<ClientId>();
  const defaultPayload: JWTPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
    exp: 60,
    jti: generateId(),
    iat: 5,
  };

  const actualPayload = {
    ...defaultPayload,
    ...standardClaimsOverride,
    ...customClaims,
  };

  const headers = {
    alg: "RS256",
    kid: "kid",
    ...customHeader,
  };

  return await signClientAssertion({
    payload: actualPayload,
    headers,
    keySet,
  });
};

export const signClientAssertion = async ({
  payload,
  headers,
  keySet: maybeKeySet,
}: {
  payload: JWTPayload;
  headers: JWTHeaderParameters;
  keySet?: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const keySet: crypto.KeyPairKeyObjectResult =
    maybeKeySet ??
    crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
  const pemPrivateKey = keySet.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const privateKey = await importPKCS8(
    Buffer.isBuffer(pemPrivateKey)
      ? pemPrivateKey.toString("utf8")
      : pemPrivateKey,
    "RS256"
  );

  return await new SignJWT(payload)
    .setProtectedHeader(headers)
    .sign(privateKey);
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
  async (): Promise<ClientAssertionValidationRequest> => {
    const keySet = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    return {
      client_id: generateId<ClientId>(),
      client_assertion_type: EXPECTED_CLIENT_ASSERTION_TYPE,
      client_assertion: await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
        keySet,
      }),
      grant_type: EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
    };
  };
