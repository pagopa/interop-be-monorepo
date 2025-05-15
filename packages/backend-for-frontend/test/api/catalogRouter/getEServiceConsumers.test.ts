/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  RiskAnalysisId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import {
  eserviceDescriptorNotFound,
  eserviceRiskNotFound,
  invalidEServiceRequester,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /eservices/:eServiceId/consumers", () => {
  const mockEServiceId = generateId<EServiceId>();
  const mockResponse = {
    filename: "name",
    file: Buffer.from("contents"),
  };

  const makeRequest = async (
    token: string,
    eServiceId: unknown = mockEServiceId
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/${eServiceId}/consumers`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    services.catalogService.getEServiceConsumers = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse.file);
  });

  it.each([
    {
      error: eserviceRiskNotFound(mockEServiceId, generateId<RiskAnalysisId>()),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorNotFound(
        mockEServiceId,
        generateId<DescriptorId>()
      ),
      expectedStatus: 404,
    },
    {
      error: invalidEServiceRequester(mockEServiceId, generateId<TenantId>()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.getEServiceConsumers = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
