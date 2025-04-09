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
import {
  certifierWithExistingAttributes,
  tenantIsAlreadyACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API /maintenance/tenants/{tenantId}/certifier authorization test", () => {
  const tenant: Tenant = getMockTenant();
  const certifierId = generateId();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  vi.spyOn(tenantService, "addCertifierId").mockResolvedValue(tenant);

  const allowedRoles: UserRole[] = [userRoles.MAINTENANCE_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post(`/maintenance/tenants/${tenant.id}/certifier`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ certifierId });

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

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(tenantService, "addCertifierId").mockRejectedValue(
      tenantNotFound(tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for tenantIsAlreadyACertifier", async () => {
    vi.spyOn(tenantService, "addCertifierId").mockRejectedValue(
      tenantIsAlreadyACertifier(tenant.id, certifierId)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 409 for certifierWithExistingAttributes", async () => {
    vi.spyOn(tenantService, "addCertifierId").mockRejectedValue(
      certifierWithExistingAttributes(tenant.id, certifierId)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
