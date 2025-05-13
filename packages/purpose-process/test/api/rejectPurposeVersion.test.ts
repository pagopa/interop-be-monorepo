/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
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
import {
  notValidVersionState,
  organizationIsNotTheDelegatedProducer,
  organizationIsNotTheProducer,
  purposeNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/reject test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };

  beforeEach(() => {
    purposeService.rejectPurposeVersion = vi
      .fn()
      .mockResolvedValue(mockPurposeVersion);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id,
    versionId: string = mockPurposeVersion.id,
    data: purposeApi.RejectPurposeVersionPayload = {
      rejectionReason: "Mock rejection reason",
    }
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions/${versionId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
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
    { error: organizationIsNotTheProducer(generateId()), expectedStatus: 403 },
    {
      error: organizationIsNotTheDelegatedProducer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
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
      purposeService.rejectPurposeVersion = vi.fn().mockRejectedValue(error);
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
