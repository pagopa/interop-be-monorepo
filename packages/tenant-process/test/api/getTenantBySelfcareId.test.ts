/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateId, Tenant } from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import { tenantNotFoundBySelfcareId } from "../../src/model/domain/errors.js";

describe("API /tenants/selfcare/{selfcareId} authorization test", () => {
  const tenant: Tenant = getMockTenant();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  vi.spyOn(tenantService, "getTenantBySelfcareId").mockResolvedValue(tenant);

  const allowedRoles: UserRole[] = [
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.SUPPORT_ROLE,
    userRoles.INTERNAL_ROLE,
    userRoles.M2M_ROLE,
  ];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .get(`/tenants/selfcare/${tenant.selfcareId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(allowedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => !allowedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFoundBySelfcareId", async () => {
    vi.spyOn(tenantService, "getTenantBySelfcareId").mockRejectedValue(
      tenantNotFoundBySelfcareId(generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });
});
