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
import {
  mailAlreadyExists,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API /tenants/{tenantId}/mails authorization test", () => {
  const tenant: Tenant = getMockTenant();
  const mailSeed: tenantApi.MailSeed = {
    kind: "CONTACT_EMAIL",
    address: "testMail@test.it",
    description: "mail description",
  };

  vi.spyOn(tenantService, "addTenantMail").mockResolvedValue();

  const allowedRoles: UserRole[] = [userRoles.ADMIN_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post(`/tenants/${tenant.id}/mails`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mailSeed);

  it.each(allowedRoles)(
    "Should return 200 for user with role %s",
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
    vi.spyOn(tenantService, "addTenantMail").mockRejectedValue(
      tenantNotFound(tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    vi.spyOn(tenantService, "addTenantMail").mockRejectedValue(
      operationForbidden
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for mailAlreadyExists", async () => {
    vi.spyOn(tenantService, "addTenantMail").mockRejectedValue(
      mailAlreadyExists()
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
