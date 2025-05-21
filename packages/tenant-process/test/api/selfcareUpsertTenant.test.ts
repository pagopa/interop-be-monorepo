/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

  beforeEach(() => {
    tenantService.selfcareUpsertTenant = vi.fn().mockResolvedValue(tenant.id);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.INTERNAL_ROLE,
  ];

  const makeRequest = async (
    token: string,
    body: tenantApi.SelfcareTenantSeed = tenantSeed
  ) =>
    request(api)
      .post("/selfcare/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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

  it.each([
    { error: operationForbidden, expectedStatus: 403 },
    {
      error: selfcareIdConflict({
        tenantId: tenant.id,
        existingSelfcareId: selfcareId,
        newSelfcareId: selfcareId,
      }),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.selfcareUpsertTenant = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...tenantSeed, externalId: { origin: "IPA" } } },
    { body: { ...tenantSeed, externalId: { origin: 1, value: "123456" } } },
    { body: { ...tenantSeed, name: 1 } },
    { body: { ...tenantSeed, name: "" } },
    { body: { ...tenantSeed, subUnitType: "invalid" } },
    { body: { ...tenantSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as tenantApi.SelfcareTenantSeed);
    expect(res.status).toBe(400);
  });
});
