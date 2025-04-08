/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  descriptorState,
  EService,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import {
  buildRiskAnalysisSeed,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";

describe("API /eservices/{eServiceId}/riskAnalysis authorization test", () => {
  const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA));

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
  };

  vi.spyOn(catalogService, "createRiskAnalysis").mockResolvedValue();

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/eservices/${eServiceId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(riskAnalysisSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.API_ROLE])(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) => role !== userRoles.ADMIN_ROLE && role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 not found", async () => {
    const res = await makeRequest(generateToken(getMockAuthData()), "");
    expect(res.status).toBe(404);
  });
});
