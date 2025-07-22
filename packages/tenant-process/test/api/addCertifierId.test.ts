/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant, TenantId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  certifierWithExistingAttributes,
  tenantIsAlreadyACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /maintenance/tenants/{tenantId}/certifier test", () => {
  const tenant: Tenant = getMockTenant();
  const certifierId = generateId();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.addCertifierId = vi.fn().mockResolvedValue(tenant);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: tenantApi.CertifierPromotionPayload = { certifierId }
  ) =>
    request(api)
      .post(`/maintenance/tenants/${tenantId}/certifier`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Maintenance", async () => {
    const token = generateToken(authRole.MAINTENANCE_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.MAINTENANCE_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotFound(tenant.id), expectedStatus: 404 },
    {
      error: tenantIsAlreadyACertifier(tenant.id, certifierId),
      expectedStatus: 409,
    },
    {
      error: certifierWithExistingAttributes(tenant.id, certifierId),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.addCertifierId = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { certifierId, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.MAINTENANCE_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as tenantApi.CertifierPromotionPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
