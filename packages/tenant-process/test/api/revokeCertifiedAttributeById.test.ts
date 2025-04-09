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
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API /tenants/{tenantId}/attributes/certified/{attributeId} authorization test", () => {
  const tenant: Tenant = getMockTenant();
  const tenantId = tenant.id;
  const attributeId = generateId();

  vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockResolvedValue();

  const allowedRoles: UserRole[] = [userRoles.ADMIN_ROLE, userRoles.M2M_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .delete(`/tenants/${tenantId}/attributes/certified/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(allowedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => !allowedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockRejectedValue(
      tenantNotFound(tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for attributeNotFound", async () => {
    vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockRejectedValue(
      attributeNotFound(generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for attributeDoesNotBelongToCertifier", async () => {
    vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockRejectedValue(
      attributeDoesNotBelongToCertifier(generateId(), generateId(), tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockRejectedValue(
      tenantIsNotACertifier(generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for attributeAlreadyRevoked", async () => {
    vi.spyOn(tenantService, "revokeCertifiedAttributeById").mockRejectedValue(
      attributeAlreadyRevoked(generateId(), generateId(), generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
