/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  descriptorState,
  EService,
  EServiceId,
  generateId,
  operationForbidden,
  tenantKind,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockValidRiskAnalysis,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";

import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, catalogService } from "../vitest.api.setup.js";
import { buildRiskAnalysisSeed } from "../mockUtils.js";
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

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId,
    body: catalogApi.EServiceRiskAnalysisSeed = riskAnalysisSeed
  ) =>
    request(api)
      .post(`/eservices/${eServiceId}/riskAnalysis`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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

  it.each([
    {
      error: riskAnalysisDuplicated("riskAnalysName", mockEService.id),
      expectedStatus: 409,
    },
    {
      error: eServiceNotFound(mockEService.id),
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
      catalogService.createRiskAnalysis = vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, mockEService.id);

      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    [{}, mockEService.id],
    [{ ...riskAnalysisSeed, invalidParam: "invalidValue" }, mockEService.id],
    [{ ...riskAnalysisSeed, name: 123 }, mockEService.id],
    [{ ...riskAnalysisSeed, riskAnalysisForm: undefined }, mockEService.id],
    [{ ...riskAnalysisSeed, riskAnalysisForm: null }, mockEService.id],
    [
      {
        ...riskAnalysisSeed,
        riskAnalysisForm: { version: 1, answers: {} },
      },
      mockEService.id,
    ],
    [
      {
        ...riskAnalysisSeed,
        riskAnalysisForm: { version: "1.0", answers: "not-an-object" },
      },
      mockEService.id,
    ],
    [
      {
        ...riskAnalysisSeed,
        riskAnalysisForm: { version: "1.0", answers: { q1: "not-an-array" } },
      },
      mockEService.id,
    ],
    [
      {
        ...riskAnalysisSeed,
        riskAnalysisForm: { version: "1.0", answers: { q1: [123] } },
      },
      mockEService.id,
    ],
    [{ ...riskAnalysisSeed }, "invalidId"],
  ])(
    "Should return 400 if passed invalid params: %s (eServiceId: %s)",
    async (body, eServiceId) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId as EServiceId,
        body as catalogApi.EServiceRiskAnalysisSeed
      );

      expect(res.status).toBe(400);
    }
  );
});
