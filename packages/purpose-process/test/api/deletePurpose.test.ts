/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken, getMockPurpose } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
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

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.deletePurpose = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    purposeService.deletePurpose = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegatedConsumer", async () => {
    purposeService.deletePurpose = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegatedConsumer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for purposeCannotBeDeleted", async () => {
    purposeService.deletePurpose = vi
      .fn()
      .mockRejectedValue(purposeCannotBeDeleted(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
