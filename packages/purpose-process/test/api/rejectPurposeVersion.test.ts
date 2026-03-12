/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  PurposeId,
  PurposeVersionId,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { purposeApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  notValidVersionState,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
  purposeNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/reject test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };
  const defaultBody: purposeApi.RejectPurposeVersionPayload = {
    rejectionReason: "Mock rejection reason",
  };

  beforeEach(() => {
    purposeService.rejectPurposeVersion = vi
      .fn()
      .mockResolvedValue(mockPurposeVersion);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    versionId: PurposeVersionId = mockPurposeVersion.id,
    body: purposeApi.RejectPurposeVersionPayload = defaultBody
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions/${versionId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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
    { error: tenantIsNotTheProducer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedProducer(
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

  it.each([
    { purposeId: "invalid" as PurposeId },
    { versionId: "invalid" as PurposeVersionId },
    { body: {} },
    { body: { rejectionReason: "too short" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, versionId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        versionId,
        body as purposeApi.RejectPurposeVersionPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
