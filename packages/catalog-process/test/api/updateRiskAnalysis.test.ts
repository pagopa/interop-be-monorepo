/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  EServiceId,
  generateId,
  operationForbidden,
  RiskAnalysisId,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysis,
  getMockEService,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  eServiceRiskAnalysisNotFound,
  riskAnalysisDuplicated,
  riskAnalysisValidationFailed,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId} authorization test", () => {
  const riskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);

  const mockEService: EService = {
    ...getMockEService(),
    riskAnalysis: [riskAnalysis],
  };

  const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(riskAnalysis);

  catalogService.updateRiskAnalysis = vi.fn().mockResolvedValue({});

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    riskAnalysisId: RiskAnalysisId,
    body: catalogApi.EServiceRiskAnalysisSeed = riskAnalysisSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/riskAnalysis/${riskAnalysisId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id, riskAnalysis.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id, riskAnalysis.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: riskAnalysisDuplicated(riskAnalysis.name, mockEService.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(mockEService.id),
      expectedStatus: 404,
    },
    {
      error: eServiceRiskAnalysisNotFound(mockEService.id, riskAnalysis.id),
      expectedStatus: 404,
    },
    {
      error: templateInstanceNotAllowed(
        mockEService.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        mockEService.templateId!
      ),
      expectedStatus: 403,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eserviceNotInDraftState(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: eserviceNotInReceiveMode(mockEService.id),
      expectedStatus: 400,
    },
    {
      error: riskAnalysisValidationFailed([]),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.updateRiskAnalysis = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id, riskAnalysis.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id, riskAnalysis.id],
    [{ name: 123 }, mockEService.id, riskAnalysis.id],
    [{ riskAnalysisForm: "invalid" }, mockEService.id, riskAnalysis.id],
    [
      { name: "ValidName", riskAnalysisForm: null },
      mockEService.id,
      riskAnalysis.id,
    ],
    [{ ...riskAnalysisSeed }, "invalidId", riskAnalysis.id],
    [{ ...riskAnalysisSeed }, mockEService.id, "invalidId"],
  ])(
    "Should return 400 if passed invalid risk analysis seed: %s (eServiceId: %s, riskAnalysisId: %s)",
    async (body, eServiceId, riskAnalysisId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        riskAnalysisId as RiskAnalysisId,
        body as catalogApi.EServiceRiskAnalysisSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
