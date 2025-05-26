/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeId,
  PurposeVersionId,
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
import {
  notValidVersionState,
  tenantNotAllowed,
  purposeNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";
import { purposeVersionToApiPurposeVersion } from "../../src/model/domain/apiConverter.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/suspend test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };
  const serviceResponse = getMockWithMetadata(mockPurposeVersion);

  const apiResponse = purposeApi.PurposeVersion.parse(
    purposeVersionToApiPurposeVersion(mockPurposeVersion)
  );

  beforeEach(() => {
    purposeService.suspendPurposeVersion = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    versionId: PurposeVersionId = mockPurposeVersion.id
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions/${versionId}/suspend`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
    { error: purposeNotFound(mockPurpose.id), expectedStatus: 404 },
    {
      error: purposeVersionNotFound(mockPurpose.id, mockPurposeVersion.id),
      expectedStatus: 404,
    },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: notValidVersionState(
        mockPurposeVersion.id,
        purposeVersionState.draft
      ),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.suspendPurposeVersion = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { purposeId: "invalid" as PurposeId },
    { versionId: "invalid" as PurposeVersionId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, versionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeId, versionId);
      expect(res.status).toBe(400);
    }
  );
});
