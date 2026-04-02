import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { describe, beforeEach, vi, it, expect } from "vitest";
import { generateId } from "pagopa-interop-models";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { services, api } from "../../vitest.api.setup.js";

describe("API POST /tools/validateDPoPProof", () => {
  const mockRequest: bffApi.AccessDPoPProofRequest = {
    dpop_proof: "eyJhbGciOiJSUzI1NiIsInR5cCI6ImRwb3Arand0IiwiaHdrIjp7... ",
    htu: "https://auth.interop.pagopa.it/token",
    htm: "POST",
  };

  const mockResult: bffApi.DPoPProofValidationResult = {
    steps: {
      dpopProofValidation: { result: "PASSED", failures: [] },
      dpopMatchValidation: { result: "PASSED", failures: [] },
      dpopSignatureVerification: { result: "PASSED", failures: [] },
    },
  };

  beforeEach(() => {
    services.toolsService.validateDPoPProof = vi.fn().mockResolvedValue(
      mockResult
    );
  });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const makeRequest = async (
    token: string,
    body: bffApi.AccessDPoPProofRequest = mockRequest
  ) =>
    request(api)
      .post(`${appBasePath}/tools/validateDPoPProof`)
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
    { body: { ...mockRequest, htu: 123 } },
    { body: { ...mockRequest, htm: 123 } },
    { body: { ...mockRequest, dpop_proof: 123 } },
  ])("Should return 400 for invalid input: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.AccessDPoPProofRequest);
    expect(res.status).toBe(400);
  });
});
