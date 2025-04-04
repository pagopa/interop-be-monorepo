/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  EService,
  EServiceId,
  generateId,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId} authorization test", () => {
  const riskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
  const eservice: EService = {
    ...getMockEService(),
    riskAnalysis: [riskAnalysis],
  };

  vi.spyOn(catalogService, "deleteRiskAnalysis").mockResolvedValue();

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    riskAnalysisId: RiskAnalysisId
  ) =>
    request(api)
      .delete(`/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });
      const res = await makeRequest(token, eservice.id, riskAnalysis.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, eservice.id, riskAnalysis.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(
      generateToken(getMockAuthData()),
      "" as EServiceId,
      "" as RiskAnalysisId
    );
    expect(res.status).toBe(404);
  });
});
