/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { selfcareIdConflict } from "../../src/model/domain/errors.js";

describe("API POST /selfcare/tenants test", () => {
  const tenant = {
    ...getMockTenant(),
    onboardedAt: new Date(),
    selfcareId: generateId(),
  };
  const selfcareId = tenant.selfcareId;
  const tenantSeed: tenantApi.SelfcareTenantSeed = {
    externalId: {
      origin: tenant.externalId.origin,
      value: tenant.externalId.value,
    },
    name: "A tenant",
    selfcareId,
    onboardedAt: tenant.onboardedAt.toISOString(),
    subUnitType: tenant.subUnitType,
  };

  const apiResponse = tenantApi.ResourceId.parse({ id: tenant.id });

  tenantService.selfcareUpsertTenant = vi.fn().mockResolvedValue(tenant.id);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.INTERNAL_ROLE,
  ];

  const makeRequest = async (token: string, data: object = tenantSeed) =>
    request(api)
      .post("/selfcare/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for operationForbidden", async () => {
    tenantService.selfcareUpsertTenant = vi
      .fn()
      .mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for selfcareIdConflict", async () => {
    tenantService.selfcareUpsertTenant = vi.fn().mockRejectedValue(
      selfcareIdConflict({
        tenantId: tenant.id,
        existingSelfcareId: selfcareId,
        newSelfcareId: selfcareId,
      })
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid tenant seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      externalId: {
        origin: tenant.externalId.origin,
        value: tenant.externalId.value,
      },
      selfcareId,
      onboardedAt: tenant.onboardedAt.toISOString(),
      subUnitType: tenant.subUnitType,
    });
    expect(res.status).toBe(400);
  });
});
