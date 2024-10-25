import crypto from "crypto";
import {
  ClientId,
  clientKindTokenStates,
  DescriptorId,
  generateId,
  itemState,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
import {
  generateKeySet,
  getMockClientAssertion,
} from "pagopa-interop-commons-test";
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

export const getMockTokenKey = (): Key => ({
  clientId: generateId<ClientId>(),
  consumerId: generateId<TenantId>(),
  kid: "kid",
  publicKey: generateKeySet().publicKeyEncodedPem,
  algorithm: "RS256",
});

export const getMockConsumerKey = (): ConsumerKey => ({
  ...getMockTokenKey(),
  purposeId: generateId<PurposeId>(),
  clientKind: clientKindTokenStates.consumer,
  purposeState: {
    state: itemState.active,
    versionId: generateId<PurposeVersionId>(),
  },
  agreementId: generateId(),
  agreementState: { state: itemState.active },
  eServiceId: generateId(),
  eServiceState: {
    state: itemState.active,
    descriptorId: generateId<DescriptorId>(),
    audience: ["test.interop.pagopa.it"],
    voucherLifespan: 60,
  },
});

export const getMockApiKey = (): ApiKey => ({
  ...getMockTokenKey(),
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
