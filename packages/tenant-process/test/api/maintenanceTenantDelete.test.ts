/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant, TenantId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";

describe("API DELETE /maintenance/tenants/{tenantId} test", () => {
  const tenant: Tenant = getMockTenant();
  const defaultBody = { currentVersion: 0 };

  beforeEach(() => {
    tenantService.maintenanceTenantDelete = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: { currentVersion: number } = defaultBody
  ) =>
    request(api)
      .delete(`/maintenance/tenants/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.MAINTENANCE_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.maintenanceTenantDelete = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { currentVersion: "0" } },
    { body: { currentVersion: 0, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as { currentVersion: number }
      );
      expect(res.status).toBe(400);
    }
  );
});
