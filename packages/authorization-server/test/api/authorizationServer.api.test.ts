/* eslint-disable @typescript-eslint/explicit-function-return-type */
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  algorithm,
  ClientId,
  generateId,
  makeTokenGenerationStatesClientKidPK,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  InteropApiToken,
  InteropConsumerToken,
  InteropJwtApiPayload,
  InteropJwtConsumerPayload,
  InteropJwtHeader,
} from "pagopa-interop-commons";
import { getMockClient, getMockDPoPProof } from "pagopa-interop-commons-test";
import { api, tokenService } from "../vitest.api.setup.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  dpopProofJtiAlreadyUsed,
  dpopProofSignatureValidationFailed,
  dpopProofValidationFailed,
  platformStateValidationFailed,
  tokenGenerationStatesEntryNotFound,
} from "../../src/model/domain/errors.js";
import { GeneratedTokenData } from "../../src/services/tokenService.js";

describe("POST /authorization-server/token.oauth2", async () => {
  const clientId = getMockClient().id;
  const tokenClientKidPK = makeTokenGenerationStatesClientKidPK({
    clientId,
    kid: "",
  });

  const header: InteropJwtHeader = {
    alg: algorithm.RS256,
    use: "sig",
    typ: "at+jwt",
    kid: generateId(),
  };

  const consumerPayload: InteropJwtConsumerPayload = {
    jti: generateId(),
    iss: "interop.pagopa.it",
    aud: ["interop.pagopa.it"],
    iat: 10,
    nbf: 100,
    exp: 100,
    client_id: clientId,
    sub: generateId<ClientId>(),
    purposeId: generateId<PurposeId>(),
  };

  const apiPayload: InteropJwtApiPayload = {
    jti: generateId(),
    iss: "interop.pagopa.it",
    aud: ["interop.pagopa.it"],
    iat: 10,
    nbf: 100,
    exp: 100,
    client_id: clientId,
    sub: generateId<ClientId>(),
    organizationId: generateId<TenantId>(),
    role: "m2m",
  };

  const consumerToken: InteropConsumerToken = {
    header,
    payload: consumerPayload,
    serialized: "",
  };

  const apiToken: InteropApiToken = {
    header,
    payload: apiPayload,
    serialized: "",
  };

  const validRequestBody: authorizationServerApi.AccessTokenRequest = {
    client_id: "e58035ce-c753-4f72-b613-46f8a17b71cc",
    client_assertion: "valid-jws-token",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    grant_type: "client_credentials",
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = (
    body: authorizationServerApi.AccessTokenRequest = validRequestBody
  ) =>
    request(api)
      .post("/authorization-server/token.oauth2")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(body);

  const { dpopProofJWS } = await getMockDPoPProof();

  const makeDPoPRequest = (
    body: authorizationServerApi.AccessTokenRequest = validRequestBody,
    dpopProof: string = dpopProofJWS
  ) =>
    request(api)
      .post("/authorization-server/token.oauth2")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("DPoP", dpopProof)
      .send(new URLSearchParams(body).toString());

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([consumerToken, apiToken])(
    "Should return 200 for valid Bearer request",
    async (token) => {
      tokenService.generateToken = vi.fn().mockResolvedValue({
        limitReached: false,
        token,
        rateLimiterStatus: {
          maxRequests: 100,
          rateInterval: 1,
          remainingRequests: 10,
        },
      } satisfies GeneratedTokenData);

      const res = await makeRequest();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        access_token: "",
        token_type: "Bearer",
        expires_in: 90,
      });
      expect(res.headers["x-rate-limit-limit"]).toBe("100");
      expect(res.headers["x-rate-limit-interval"]).toBe("1");
      expect(res.headers["x-rate-limit-remaining"]).toBe("10");
    }
  );

  it.each([consumerToken, apiToken])(
    "Should return 200 for valid DPoP request",
    async (token) => {
      tokenService.generateToken = vi.fn().mockResolvedValue({
        limitReached: false,
        token,
        rateLimiterStatus: {
          maxRequests: 100,
          rateInterval: 1,
          remainingRequests: 10,
        },
        isDPoP: true,
      } satisfies GeneratedTokenData);

      const res = await makeDPoPRequest();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        access_token: "",
        token_type: "DPoP",
        expires_in: 90,
      });
      expect(res.headers["x-rate-limit-limit"]).toBe("100");
      expect(res.headers["x-rate-limit-interval"]).toBe("1");
      expect(res.headers["x-rate-limit-remaining"]).toBe("10");
      expect(tokenService.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ DPoP: dpopProofJWS }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    }
  );

  it("Should return 400 for a bad formatted request body", async () => {
    const res = await request(api)
      .post("/authorization-server/token.oauth2")
      .set("Content-Type", "application/json")
      .send("wrong-formatted-json");

    expect(res.status).toBe(400);
  });

  it.each([
    {
      error: tokenGenerationStatesEntryNotFound(tokenClientKidPK),
      expectedStatus: 400,
    },
    {
      error: clientAssertionRequestValidationFailed(clientId, ""),
      expectedStatus: 400,
    },
    {
      error: clientAssertionSignatureValidationFailed(clientId, ""),
      expectedStatus: 400,
    },
    {
      error: clientAssertionValidationFailed(clientId, ""),
      expectedStatus: 400,
    },
    {
      error: platformStateValidationFailed(""),
      expectedStatus: 400,
    },
    {
      error: dpopProofValidationFailed(clientId, ""),
      expectedStatus: 400,
    },
    {
      error: dpopProofSignatureValidationFailed(clientId, ""),
      expectedStatus: 400,
    },
    {
      error: dpopProofJtiAlreadyUsed(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tokenService.generateToken = vi.fn().mockRejectedValue(error);
      const res = await makeRequest();
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 429 in case the rate limit is reached", async () => {
    tokenService.generateToken = vi.fn().mockResolvedValue({
      token: consumerToken,
      rateLimiterStatus: {},
      limitReached: true,
      rateLimitedTenantId: generateId<TenantId>(),
    });

    const res = await makeRequest();
    expect(res.status).toBe(429);
  });

  it.each([
    {},
    { ...validRequestBody, client_id: "invalidId" },
    { ...validRequestBody, grant_type: "invalid-type" },
  ])("Should return 400 if passed invalid params: %s", async (body) => {
    const res = await makeRequest(
      body as authorizationServerApi.AccessTokenRequest
    );
    expect(res.status).toBe(400);
  });
});
