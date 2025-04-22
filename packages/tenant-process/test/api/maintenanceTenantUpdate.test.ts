/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, TenantId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import { getMockMaintenanceTenantUpdate } from "../mockUtils.js";

describe("API /maintenance/tenants/{tenantId} authorization test", () => {
  const tenantId = generateId<TenantId>();
  const maintenanceTenantUpdate = getMockMaintenanceTenantUpdate();

  vi.spyOn(tenantService, "maintenanceTenantUpdate").mockResolvedValue();

  const makeRequest = async (token: string) =>
    request(api)
      .post(`/maintenance/tenants/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ currentVersion: 0, tenant: maintenanceTenantUpdate });

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
    vi.spyOn(tenantService, "maintenanceTenantUpdate").mockRejectedValue(
      tenantNotFound(tenantId)
    );
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });
});
