/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  generateId,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import { mailNotFound, tenantNotFound } from "../../src/model/domain/errors.js";

describe("API DELETE /tenants/{tenantId}/mails/{mailId} test", () => {
  const tenantId = generateId<TenantId>();
  const mailId = generateId();

  beforeEach(() => {
    tenantService.deleteTenantMailById = vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (token: string) =>
    request(api)
      .delete(`/tenants/${tenantId}/mails/${mailId}`)
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

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.deleteTenantMailById = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    tenantService.deleteTenantMailById = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for mailNotFound", async () => {
    tenantService.deleteTenantMailById = vi
      .fn()
      .mockRejectedValue(mailNotFound(mailId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .delete(`/tenants/invalid-id/mails/${mailId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());
    expect(res.status).toBe(400);
  });
});
