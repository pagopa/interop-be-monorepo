import {
  getMockClientAssertion,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  ClientId,
  DescriptorId,
  EServiceId,
  GeneratedTokenAuditDetails,
  generateId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { dateToSeconds, InteropTokenGenerator } from "pagopa-interop-commons";
import { tokenServiceBuilder } from "../src/services/tokenService.js";
import { config } from "../src/config/config.js";

export const configTokenGenerationStates = inject(
  "tokenGenerationReadModelConfig"
);

export const { cleanup, fileManager, redisRateLimiter } =
  await setupTestContainersVitest(
    undefined,
    undefined,
    inject("fileManagerConfig"),
    undefined,
    inject("redisRateLimiterConfig")
  );

afterEach(cleanup);

if (configTokenGenerationStates === undefined) {
  throw new Error("configTokenGenerationStates is undefined");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${configTokenGenerationStates.tokenGenerationReadModelDbPort}`,
});

export const mockProducer = {
  send: vi.fn(),
};
export const mockKMSClient = {
  send: vi.fn(),
};

const tokenGenerator = new InteropTokenGenerator(
  {
    generatedInteropTokenKid: config.generatedInteropTokenKid,
    generatedInteropTokenIssuer: config.generatedInteropTokenIssuer,
    generatedInteropTokenM2MAudience: config.generatedInteropTokenM2MAudience,
    generatedInteropTokenM2MDurationSeconds:
      config.generatedInteropTokenM2MDurationSeconds,
  },
  mockKMSClient as unknown as KMSClient
);

export const tokenService = tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  // redisRateLimiter,
  producer: mockProducer as unknown as Awaited<ReturnType<typeof initProducer>>,
  fileManager,
});

export const getMockAccessTokenRequest =
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
    algorithm: "RS256",
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
      algorithm: "RS256",
      keyId: kid,
      jwtId: clientAssertionJti,
      issuedAt: dateToSeconds(new Date()),
      issuer: consumerId,
      expirationTime: dateToSeconds(new Date()),
    },
  };
};
