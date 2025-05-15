/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, TenantId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";
import { getMockMaintenanceTenantUpdate } from "../mockUtils.js";

describe("API POST /maintenance/tenants/{tenantId} test", () => {
  const defaultTenantId = generateId<TenantId>();
  const maintenanceTenantUpdate = getMockMaintenanceTenantUpdate();
  const defaultBody = { currentVersion: 0, tenant: maintenanceTenantUpdate };

  beforeEach(() => {
    tenantService.maintenanceTenantUpdate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = defaultTenantId,
    body: object = defaultBody
  ) =>
    request(api)
      .post(`/maintenance/tenants/${tenantId}`)
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

  it.each([{ error: tenantNotFound(defaultTenantId), expectedStatus: 404 }])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.maintenanceTenantUpdate = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { ...defaultBody, currentVersion: "invalid" } },
    {
      body: {
        ...defaultBody,
        tenant: { ...defaultBody.tenant, kind: "invalid" },
      },
    },
    { body: { ...defaultBody, extraField: 1 } },
    {
      body: {
        ...defaultBody,
        tenant: { ...defaultBody.tenant, extraField: "1" },
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(token, tenantId, body);
      expect(res.status).toBe(400);
    }
  );
});
