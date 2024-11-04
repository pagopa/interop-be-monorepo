import crypto from "crypto";
import { ClientId, generateId, TenantId } from "pagopa-interop-models";
import {
  generateKeySet,
  getMockClientAssertion,
} from "pagopa-interop-commons-test";
import { ClientAssertionValidationRequest, Key } from ".././src/types.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "../src/utils.js";

export const value64chars = crypto.randomBytes(32).toString("hex");

export const getMockTokenKey = (): Key => ({
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "kid",
  publicKey: generateKeySet().publicKeyEncodedPem,
  algorithm: "RS256",
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
