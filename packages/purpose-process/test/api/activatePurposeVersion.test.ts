/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  PurposeId,
  PurposeVersionId,
  generateId,
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
import { purposeVersionToApiPurposeVersion } from "../../src/model/domain/apiConverter.js";
import {
  agreementNotFound,
  missingRiskAnalysis,
  tenantIsNotTheConsumer,
  tenantIsNotTheProducer,
  tenantNotAllowed,
  purposeNotFound,
  purposeVersionNotFound,
  riskAnalysisValidationFailed,
  tenantIsNotTheDelegatedConsumer,
  tenantIsNotTheDelegate,
  purposeTemplateNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/activate test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };
  const serviceResponse = getMockWithMetadata(mockPurposeVersion);

  const apiResponse = purposeApi.PurposeVersion.parse(
    purposeVersionToApiPurposeVersion(mockPurposeVersion)
  );

  beforeEach(() => {
    purposeService.activatePurposeVersion = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    versionId: PurposeVersionId = mockPurposeVersion.id,
    delegationId?: DelegationId
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions/${versionId}/activate`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ delegationId });

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
    { error: missingRiskAnalysis(mockPurpose.id), expectedStatus: 400 },
    {
      error: agreementNotFound(generateId(), generateId()),
      expectedStatus: 400,
    },
    { error: riskAnalysisValidationFailed([]), expectedStatus: 400 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    {
      error: purposeVersionNotFound(mockPurpose.id, mockPurposeVersion.id),
      expectedStatus: 404,
    },
    {
      error: purposeTemplateNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    {
      error: tenantIsNotTheDelegate(generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.activatePurposeVersion = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { purposeId: "invalid" as PurposeId, versionId: mockPurposeVersion.id },
    { purposeId: mockPurpose.id, versionId: "invalid" as PurposeVersionId },
    {
      purposeId: mockPurpose.id,
      versionId: mockPurposeVersion.id,
      delegationId: "invalid" as DelegationId,
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, versionId, delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeId, versionId, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
