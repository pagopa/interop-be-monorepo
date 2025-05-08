/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  descriptorState,
  EService,
  generateId,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  buildRiskAnalysisSeed,
  getMockDescriptor,
  getMockEService,
} from "../mockUtils.js";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  riskAnalysisDuplicated,
  riskAnalysisValidationFailed,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId}/riskAnalysis authorization test", () => {
  const riskAnalysisSeed: catalogApi.EServiceRiskAnalysisSeed =
    buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA));

  const mockEService: EService = {
    ...getMockEService(),
    descriptors: [{ ...getMockDescriptor(), state: descriptorState.draft }],
  };

  catalogService.createRiskAnalysis = vi.fn().mockResolvedValue({});

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .post(`/eservices/${eServiceId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(riskAnalysisSeed);
  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEService.id);

    expect(res.status).toBe(403);
  });

  it("Should return 409 for riskAnalysisDuplicated", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(
        riskAnalysisDuplicated("riskAnalysName", mockEService.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(409);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for templateInstanceNotAllowed", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(
        templateInstanceNotAllowed(mockEService.id, mockEService.templateId!)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for operationForbidden", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for eserviceNotInDraftState", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(eserviceNotInDraftState(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for eserviceNotInReceiveMode", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(eserviceNotInReceiveMode(mockEService.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for riskAnalysisValidationFailed", async () => {
    catalogService.createRiskAnalysis = vi
      .fn()
      .mockRejectedValue(riskAnalysisValidationFailed([]));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockEService.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid field", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
