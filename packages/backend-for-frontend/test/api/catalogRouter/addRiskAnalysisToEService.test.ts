/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockBffApiEServiceRiskAnalysisSeed } from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/riskAnalysis", () => {
  const mockEServiceRiskAnalysisSeed = getMockBffApiEServiceRiskAnalysisSeed();

  beforeEach(() => {
    clients.catalogProcessClient.createRiskAnalysis = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    body: bffApi.EServiceRiskAnalysisSeed = mockEServiceRiskAnalysisSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { body: {} },
    { body: { ...mockEServiceRiskAnalysisSeed, extraField: 1 } },
    { body: { ...mockEServiceRiskAnalysisSeed, riskAnalysisForm: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.EServiceRiskAnalysisSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
