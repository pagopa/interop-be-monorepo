/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { tenantNotFound } from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API DELETE /maintenance/tenants/{tenantId}/remoteIds/{origin} test", () => {
  const tenant = getMockTenant();
  const origin = "ISTAT";

  beforeEach(() => {
    tenantService.maintenanceTenantDeleteRemoteId = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    remoteIdOrigin: string = origin
  ) =>
    request(api)
      .delete(`/maintenance/tenants/${tenantId}/remoteIds/${remoteIdOrigin}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

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
    tenantService.maintenanceTenantDeleteRemoteId = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid tenantId", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token, "invalid" as TenantId);
    expect(res.status).toBe(400);
  });
});
