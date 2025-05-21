/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken, getMockPurpose } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  purposeCannotBeDeleted,
  purposeNotFound,
} from "../../src/model/domain/errors.js";

describe("API DELETE /purposes/{id} test", () => {
  const mockPurpose = getMockPurpose();

  beforeEach(() => {
    purposeService.deletePurpose = vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id
  ) =>
    request(api)
      .delete(`/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegatedConsumer(
        generateId(),
        generateId<DelegationId>()
      ),
      expectedStatus: 403,
    },
    { error: purposeCannotBeDeleted(mockPurpose.id), expectedStatus: 409 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.deletePurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([{ purposeId: "invalid" }])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeId);
      expect(res.status).toBe(400);
    }
  );
});
