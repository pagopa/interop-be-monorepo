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
import { expect } from "vitest";
import {
  ApiKey,
  ClientAssertionHeader,
  ClientAssertionValidationRequest,
  ConsumerKey,
  FailedValidation,
  SuccessfulValidation,
  ValidationResult,
} from ".././src/types.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "../src/utils.js";

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
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "",
  purposeId: generateId<PurposeId>(),
  publicKey: "TODO",
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
  kid: "",
  purposeId: generateId<PurposeId>(),
  publicKey: "TODO",
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
        payload: {},
        customClaims: {},
        keySet,
      }),
      grant_type: EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
    };
  };

export function expectValidationFailed(
  validationResult: ValidationResult<unknown>
): asserts validationResult is FailedValidation {
  expect(validationResult.hasSucceeded).toBe(false);
}

export function expectValidationSucceeded<T>(
  validationResult: ValidationResult<T>
): asserts validationResult is SuccessfulValidation<T> {
  expect(validationResult.hasSucceeded).toBe(true);
}
