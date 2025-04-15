/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateId, TenantId } from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import { getMockMaintenanceTenantUpdate } from "../mockUtils.js";

describe("API /maintenance/tenants/{tenantId} authorization test", () => {
  const tenantId = generateId<TenantId>();
  const maintenanceTenantUpdate = getMockMaintenanceTenantUpdate();

  vi.spyOn(tenantService, "maintenanceTenantUpdate").mockResolvedValue();

  const allowedRoles: UserRole[] = [userRoles.MAINTENANCE_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post(`/maintenance/tenants/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ currentVersion: 0, tenant: maintenanceTenantUpdate });

  it.each(allowedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => !allowedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(tenantService, "maintenanceTenantUpdate").mockRejectedValue(
      tenantNotFound(tenantId)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });
});
