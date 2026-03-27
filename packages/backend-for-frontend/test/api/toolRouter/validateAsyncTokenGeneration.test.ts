import request from "supertest";
import { describe, beforeEach, vi, it, expect } from "vitest";
import { generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { tenantNotAllowed } from "../../../src/model/errors.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API POST /tools/validateAsyncTokenGeneration", () => {
  const mockRequest: bffApi.AccessTokenRequest = {
    client_id: generateId(),
    client_assertion: "eyJhbGciOi...",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    grant_type: "client_credentials",
  };

  const mockResult: bffApi.TokenGenerationValidationResult = {
    clientKind: "CONSUMER",
    steps: {
      clientAssertionValidation: { result: "PASSED", failures: [] },
      publicKeyRetrieve: { result: "PASSED", failures: [] },
      clientAssertionSignatureVerification: {
        result: "PASSED",
        failures: [],
      },
      platformStatesVerification: { result: "PASSED", failures: [] },
    },
  };

  beforeEach(() => {
    services.toolsService.validateAsyncTokenGeneration = vi
      .fn()
      .mockResolvedValue(mockResult);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.AccessTokenRequest = mockRequest
  ) =>
    request(api)
      .post(`${appBasePath}/tools/validateAsyncTokenGeneration`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("should return 200 with validation result", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
  });

  it.each([
    { body: {} },
    { body: { client_id: "invalid" } },
    { body: { ...mockRequest, client_assertion: 123 } },
    { body: { ...mockRequest, client_assertion_type: 123 } },
    { body: { ...mockRequest, grant_type: 123 } },
  ])("should return 400 for invalid input: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.AccessTokenRequest);
    expect(res.status).toBe(400);
  });

  it("should return 403 if the service rejects with tenantNotAllowed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.toolsService.validateAsyncTokenGeneration = vi
      .fn()
      .mockRejectedValue(tenantNotAllowed(mockRequest.client_id!));
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
