/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/attributes/certified test", () => {
  const tenantAttributeSeed: tenantApi.CertifiedTenantAttributeSeed = {
    id: generateId(),
  };
  const tenant: Tenant = getMockTenant();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  tenantService.addCertifiedAttribute = vi.fn().mockResolvedValue(tenant);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.M2M_ROLE];

  const makeRequest = async (
    token: string,
    data: object = tenantAttributeSeed
  ) =>
    request(api)
      .post(`/tenants/${tenant.id}/attributes/certified`)
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

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(tenantIsNotACertifier(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for attributeNotFound", async () => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for attributeDoesNotBelongToCertifier", async () => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDoesNotBelongToCertifier(generateId(), generateId(), tenant.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for certifiedAttributeAlreadyAssigned", async () => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        certifiedAttributeAlreadyAssigned(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid tenant attribute seed", async () => {
    // Remove the previous mocked error to ensure 400 is not due to it
    tenantService.addCertifiedAttribute = vi.fn().mockResolvedValue(tenant);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {});
    expect(res.status).toBe(400);
  });
});
