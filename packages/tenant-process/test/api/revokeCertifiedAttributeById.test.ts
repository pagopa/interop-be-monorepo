/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API DELETE /tenants/{tenantId}/attributes/certified/{attributeId} test", () => {
  const tenant: Tenant = getMockTenant();
  const attributeId = generateId();

  tenantService.revokeCertifiedAttributeById = vi
    .fn()
    .mockResolvedValue(undefined);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.M2M_ROLE];

  const makeRequest = async (token: string, tenantId: string = tenant.id) =>
    request(api)
      .delete(`/tenants/${tenantId}/attributes/certified/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
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
    tenantService.revokeCertifiedAttributeById = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for attributeNotFound", async () => {
    tenantService.revokeCertifiedAttributeById = vi
      .fn()
      .mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for attributeDoesNotBelongToCertifier", async () => {
    tenantService.revokeCertifiedAttributeById = vi
      .fn()
      .mockRejectedValue(
        attributeDoesNotBelongToCertifier(generateId(), generateId(), tenant.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    tenantService.revokeCertifiedAttributeById = vi
      .fn()
      .mockRejectedValue(tenantIsNotACertifier(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for attributeAlreadyRevoked", async () => {
    tenantService.revokeCertifiedAttributeById = vi
      .fn()
      .mockRejectedValue(
        attributeAlreadyRevoked(generateId(), generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
