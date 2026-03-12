/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiTenant } from "../../mockUtils.js";

describe("API GET /tenants/{tenantId} test", () => {
  const mockTenant = getMockBffApiTenant();

  beforeEach(() => {
    services.tenantService.getTenant = vi.fn().mockResolvedValue(mockTenant);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = mockTenant.id
  ) =>
    request(api)
      .get(`${appBasePath}/tenants/${tenantId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTenant);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as TenantId);
    expect(res.status).toBe(400);
  });
});
