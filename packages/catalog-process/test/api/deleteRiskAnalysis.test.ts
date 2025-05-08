/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, generateId, tenantKind } from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";

describe("API /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId} authorization test", () => {
  const riskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
  const eservice: EService = {
    ...getMockEService(),
    riskAnalysis: [riskAnalysis],
  };

  catalogService.deleteRiskAnalysis = vi.fn().mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: string,
    riskAnalysisId: string
  ) =>
    request(api)
      .delete(`/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id, riskAnalysis.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id, riskAnalysis.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), "", "");
    expect(res.status).toBe(404);
  });
});
