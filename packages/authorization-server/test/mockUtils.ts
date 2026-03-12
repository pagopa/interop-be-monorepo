import { IncomingHttpHeaders } from "http";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  getMockClientAssertion,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  generateId,
  ClientId,
  GeneratedTokenAuditDetails,
  EServiceId,
  DescriptorId,
  AgreementId,
  PurposeId,
  PurposeVersionId,
  TenantId,
  algorithm,
  genericInternalError,
} from "pagopa-interop-models";
import { inject, vi } from "vitest";
import { HttpDPoPHeader } from "../src/model/domain/models.js";

export const dpopConfig = inject("dpopConfig");
if (!dpopConfig) {
  throw genericInternalError("Invalid DPoP config");
}

export const mockProducer = {
  send: vi.fn(),
};
export const mockKMSClient = {
  send: vi.fn(),
};

const getMockAccessTokenRequest =
  async (): Promise<authorizationServerApi.AccessTokenRequest> => {
    const { jws } = await getMockClientAssertion();
    return {
      client_id: generateId<ClientId>(),
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jws,
      grant_type: "client_credentials",
    };
  };

export const getMockTokenRequest = async (
  withDPoPProof: boolean = false
): Promise<{
  headers: IncomingHttpHeaders & HttpDPoPHeader;
  body: authorizationServerApi.AccessTokenRequest;
}> => ({
  headers: {
    ...(withDPoPProof ? { DPoP: (await getMockDPoPProof()).dpopProofJWS } : {}),
  },
  body: await getMockAccessTokenRequest(),
});

export const getMockAuditMessage = (): GeneratedTokenAuditDetails => {
  const correlationId = generateId();
  const eserviceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();
  const agreementId = generateId<AgreementId>();
  const clientId = generateId<ClientId>();
  const purposeId = generateId<PurposeId>();
  const kid = "kid";
  const purposeVersionId = generateId<PurposeVersionId>();
  const consumerId = generateId<TenantId>();
  const clientAssertionJti = generateId();

  return {
    correlationId,
    eserviceId,
    descriptorId,
    agreementId,
    subject: clientId,
    audience: "pagopa.it",
    purposeId,
    algorithm: algorithm.RS256,
    clientId,
    keyId: kid,
    purposeVersionId,
    jwtId: generateId(),
    issuedAt: dateToSeconds(new Date()),
    issuer: "interop jwt issuer",
    expirationTime: dateToSeconds(new Date()),
    organizationId: consumerId,
    notBefore: 0,
    clientAssertion: {
      subject: clientId,
      audience: "pagopa.it",
      algorithm: algorithm.RS256,
      keyId: kid,
      jwtId: clientAssertionJti,
      issuedAt: dateToSeconds(new Date()),
      issuer: consumerId,
      expirationTime: dateToSeconds(new Date()),
    },
  };
};
