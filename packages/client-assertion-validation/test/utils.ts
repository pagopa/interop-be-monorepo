import crypto from "crypto";
import { ClientId, generateId } from "pagopa-interop-models";
import { getMockClientAssertion } from "pagopa-interop-commons-test";
import { ClientAssertionValidationRequest } from ".././src/types.js";
import {
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
} from "../src/utils.js";

export const value64chars = crypto.randomBytes(32).toString("hex");
export const expectedAudiences = ["test.interop.pagopa.it"];

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
