import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { describe, beforeEach, vi, it, expect } from "vitest";
import {
  generateId,
  operationForbidden,
  missingHeader,
} from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { services, api } from "../../vitest.api.setup.js";

describe("API POST /tools/validateDPoPTokenGeneration", () => {
  const mockRequest: bffApi.AccessDPoPTokenRequest = {
    dpop_proof: "eyJhbGciOiJSUzI1NiIsInR5cCI6ImRwb3Arand0IiwiaHdrIjp7... ",
    htu: "https://auth.interop.pagopa.it/token",
  };

  const mockResult: bffApi.DPoPTokenGenerationValidationResult = {
    steps: {
      dpopProofValidation: { result: "PASSED", failures: [] },
      dpopMatchValidation: { result: "PASSED", failures: [] },
      dpopSignatureVerification: { result: "PASSED", failures: [] },
    },
  };

  beforeEach(() => {
    services.toolsService.validateDPoPTokenGeneration = vi
      .fn()
      .mockResolvedValue(mockResult);
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    body: bffApi.AccessDPoPTokenRequest = mockRequest
  ) =>
    request(api)
      .post(`${appBasePath}/tools/validateDPoPTokenGeneration`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 with validation result for valid request", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
  });

  it("Should return 403 if operationForbidden error occurs", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.toolsService.validateDPoPTokenGeneration = vi
      .fn()
      .mockRejectedValue(operationForbidden);

    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if missingHeader error occurs", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    services.toolsService.validateDPoPTokenGeneration = vi
      .fn()
      .mockRejectedValue(missingHeader("X-Some-Header"));

    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });
});
