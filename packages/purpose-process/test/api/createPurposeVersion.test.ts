/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  Purpose,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeVersionToApiPurposeVersion } from "../../src/model/domain/apiConverter.js";
import {
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeVersionStateConflict,
  unchangedDailyCalls,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions test", () => {
  const mockPurpose: Purpose = getMockPurpose();
  const mockPurposeVersion = getMockPurposeVersion();

  const apiResponse = purposeApi.PurposeVersion.parse(
    purposeVersionToApiPurposeVersion(mockPurposeVersion)
  );

  purposeService.createPurposeVersion = vi
    .fn()
    .mockResolvedValue(mockPurposeVersion);

  beforeEach(() => {
    purposeService.createPurpose = vi
      .fn()
      .mockResolvedValue(mockPurposeVersion);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id,
    data: object = { dailyCalls: 10 }
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: unchangedDailyCalls(mockPurpose.id), expectedStatus: 400 },
    { error: organizationIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: organizationIsNotTheDelegatedConsumer(
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

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
