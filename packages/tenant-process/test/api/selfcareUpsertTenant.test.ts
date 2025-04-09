/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateId, operationForbidden, Tenant } from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { selfcareIdConflict } from "../../src/model/domain/errors.js";

describe("API /selfcare/tenants authorization test", () => {
  const tenant: Tenant = getMockTenant();
  const selfcareId = tenant.selfcareId!;
  const tenantSeed: tenantApi.SelfcareTenantSeed = {
    externalId: {
      origin: tenant.externalId.origin,
      value: tenant.externalId.value,
    },
    name: "A tenant",
    selfcareId,
    onboardedAt: tenant.onboardedAt!.toISOString(),
    subUnitType: tenant.subUnitType,
  };

  const apiResponse = tenantApi.ResourceId.parse({ id: tenant.id });

  vi.spyOn(tenantService, "selfcareUpsertTenant").mockResolvedValue(tenant.id);

  const allowedRoles: UserRole[] = [
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.INTERNAL_ROLE,
  ];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post("/selfcare/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(tenantSeed);

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

  it("Should return 403 for operationForbidden", async () => {
    vi.spyOn(tenantService, "selfcareUpsertTenant").mockRejectedValue(
      operationForbidden
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for selfcareIdConflict", async () => {
    vi.spyOn(tenantService, "selfcareUpsertTenant").mockRejectedValue(
      selfcareIdConflict({
        tenantId: tenant.id,
        existingSelfcareId: selfcareId,
        newSelfcareId: selfcareId,
      })
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
