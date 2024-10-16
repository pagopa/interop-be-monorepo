import crypto from "crypto";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import * as jose from "jose";
import {
  ApiKey,
  ClientAssertionValidationRequest,
  ConsumerKey,
  Key,
} from ".././src/types.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "../src/utils.js";

export const value64chars = crypto.randomBytes(32).toString("hex");

export const getMockClientAssertion = async (props?: {
  standardClaimsOverride?: Partial<jose.JWTPayload>;
  customClaims?: { [k: string]: unknown };
  customHeader?: { [k: string]: unknown };
}): Promise<{
  jws: string;
  publicKeyEncodedPem: string;
}> => {
  const { keySet, publicKeyEncodedPem } = generateKeySet();

  const clientId = generateId<ClientId>();
  const defaultPayload: jose.JWTPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
    exp: 60,
    jti: generateId(),
    iat: 5,
  };

  const actualPayload: jose.JWTPayload = {
    ...defaultPayload,
    ...props?.standardClaimsOverride,
    ...props?.customClaims,
  };

  const headers: jose.JWTHeaderParameters = {
    alg: "RS256",
    kid: "kid",
    ...props?.customHeader,
  };

  const jws = await signClientAssertion({
    payload: actualPayload,
    headers,
    keySet,
  });

  return {
    jws,
    publicKeyEncodedPem,
  };
};

export const generateKeySet = (): {
  keySet: crypto.KeyPairKeyObjectResult;
  publicKeyEncodedPem: string;
} => {
  const keySet: crypto.KeyPairKeyObjectResult = crypto.generateKeyPairSync(
    "rsa",
    {
      modulusLength: 2048,
    }
  );

  const pemPublicKey = keySet.publicKey
    .export({
      type: "spki",
      format: "pem",
    })
    .toString();

  const publicKeyEncodedPem = Buffer.from(pemPublicKey).toString("base64");
  return {
    keySet,
    publicKeyEncodedPem,
  };
};

const signClientAssertion = async ({
  payload,
  headers,
  keySet,
}: {
  payload: jose.JWTPayload;
  headers: jose.JWTHeaderParameters;
  keySet: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const pemPrivateKey = keySet.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const privateKey = await jose.importPKCS8(
    Buffer.isBuffer(pemPrivateKey)
      ? pemPrivateKey.toString("utf8")
      : pemPrivateKey,
    "RS256"
  );

  return await new jose.SignJWT(payload)
    .setProtectedHeader(headers)
    .sign(privateKey);
};

export const getMockKey = (): Key => ({
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "kid",
  publicKey: generateKeySet().publicKeyEncodedPem,
  algorithm: "RS256",
});

export const getMockConsumerKey = (): ConsumerKey => ({
  ...getMockKey(),
  purposeId: generateId<PurposeId>(),
  clientKind: clientKindTokenStates.consumer,
  purposeState: itemState.active,
  agreementId: generateId(),
  agreementState: itemState.active,
  eServiceId: generateId(),
  descriptorState: itemState.active,
});

export const getMockApiKey = (): ApiKey => ({
  ...getMockKey(),
  clientKind: clientKindTokenStates.api,
});

export const getMockAccessTokenRequest =
  async (): Promise<ClientAssertionValidationRequest> => ({
    client_id: generateId<ClientId>(),
    client_assertion_type: EXPECTED_CLIENT_ASSERTION_TYPE,
    client_assertion: (
      await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      })
    ).jws,
    grant_type: EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
  });
