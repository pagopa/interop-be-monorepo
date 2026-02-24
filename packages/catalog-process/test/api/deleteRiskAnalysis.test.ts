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
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  eServiceRiskAnalysisNotFound,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/riskAnalysis/{riskAnalysisId} authorization test", () => {
  const riskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
  const eservice: EService = {
    ...getMockEService(),
    riskAnalysis: [riskAnalysis],
  };

  const serviceResponse = getMockWithMetadata(eservice);
  catalogService.deleteRiskAnalysis = vi
    .fn()
    .mockResolvedValue(serviceResponse);

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

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id, riskAnalysis.id);
      expect(res.status).toBe(204);
      expect(res.headers["x-metadata-version"]).toEqual(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id, riskAnalysis.id);

    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: eServiceNotFound(eservice.id),
      expectedStatus: 404,
    },
    {
      error: eServiceRiskAnalysisNotFound(eservice.id, riskAnalysis.id),
      expectedStatus: 404,
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      error: templateInstanceNotAllowed(eservice.id, eservice.templateId!),
      expectedStatus: 403,
    },
    {
      error: operationForbidden,
      expectedStatus: 403,
    },
    {
      error: eserviceNotInDraftState(eservice.id),
      expectedStatus: 400,
    },
    {
      error: eserviceNotInReceiveMode(eservice.id),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      catalogService.deleteRiskAnalysis = vi.fn().mockRejectedValueOnce(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eservice.id, riskAnalysis.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { eServiceId: "invalidId", riskAnalysisId: riskAnalysis.id },
    { eServiceId: eservice.id, riskAnalysisId: "invalid" },
  ])(
    "Should return 400 if passed invalid params: %s",
    async ({ eServiceId, riskAnalysisId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        riskAnalysisId as RiskAnalysisId
      );

      expect(res.status).toBe(400);
    }
  );
});
