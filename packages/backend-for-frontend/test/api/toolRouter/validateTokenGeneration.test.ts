import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { describe, beforeEach, vi, it, expect } from "vitest";
import { generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { services, api } from "../../vitest.api.setup.js";
import { tenantNotAllowed } from "../../../src/model/errors.js";

describe("API POST /tools/validateTokenGeneration", () => {
  const mockRequest: bffApi.AccessTokenRequest = {
    client_id: generateId(),
    client_assertion: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    grant_type: "client_credentials",
  };
  const mockResult: bffApi.TokenGenerationValidationResult = {
    clientKind: "CONSUMER",
    steps: {
      clientAssertionValidation: {
        result: "PASSED",
        failures: [],
      },
      publicKeyRetrieve: {
        result: "PASSED",
        failures: [],
      },
      clientAssertionSignatureVerification: {
        result: "PASSED",
        failures: [],
      },
      platformStatesVerification: {
        result: "PASSED",
        failures: [],
      },
    },
    eservice: {
      id: generateId(),
      descriptorId: generateId(),
      version: "1",
      name: "My eService",
    },
  };

  beforeEach(() => {
    services.toolsService.validateTokenGeneration = vi
      .fn()
      .mockResolvedValue(mockResult);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    body: bffApi.AccessTokenRequest = mockRequest
  ) =>
    request(api)
      .post(`${appBasePath}/tools/validateTokenGeneration`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 with validation result for valid request", async () => {
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
  ])("Should return 400 for invalid input: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.AccessTokenRequest);
    expect(res.status).toBe(400);
  });

  it("should return 403 if tenantNotAllowed error occurs in the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.toolsService.validateTokenGeneration = vi
      .fn()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .mockRejectedValue(tenantNotAllowed(mockRequest.client_id!));
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
