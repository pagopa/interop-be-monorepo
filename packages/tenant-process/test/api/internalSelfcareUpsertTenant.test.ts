/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { selfcareIdConflict } from "../../src/model/domain/errors.js";

describe("API POST /internal/selfcare/tenants test", () => {
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
    tenantService.internalSelfcareUpsertTenant = vi
      .fn()
      .mockResolvedValue(tenant.id);
  });

  const makeRequest = async (
    token: string,
    body: tenantApi.SelfcareTenantSeed = tenantSeed
  ) =>
    request(api)
      .post("/internal/selfcare/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
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
      tenantService.internalSelfcareUpsertTenant = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
