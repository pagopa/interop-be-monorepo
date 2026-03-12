/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  PurposeId,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeVersionStateConflict,
  unchangedDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose: Purpose = getMockPurpose([mockPurposeVersion]);
  const defaultBody: purposeApi.PurposeVersionSeed = { dailyCalls: 10 };
  const isRiskAnalysisValid = true;
  const serviceResponse = getMockWithMetadata({
    purpose: mockPurpose,
    isRiskAnalysisValid,
    createdVersionId: mockPurposeVersion.id,
  });

  const apiResponse = purposeApi.CreatedPurposeVersion.parse({
    purpose: purposeToApiPurpose(mockPurpose, isRiskAnalysisValid),
    createdVersionId: mockPurposeVersion.id,
  });

  beforeEach(() => {
    purposeService.createPurposeVersion = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    body: purposeApi.PurposeVersionSeed = defaultBody
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: unchangedDailyCalls(mockPurpose.id), expectedStatus: 400 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    {
      error: purposeVersionStateConflict(
        mockPurpose.id,
        mockPurposeVersion.id,
        purposeVersionState.draft
      ),
      expectedStatus: 409,
    },
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.createPurposeVersion = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { dailyCalls: -1 } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as purposeApi.PurposeVersionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
