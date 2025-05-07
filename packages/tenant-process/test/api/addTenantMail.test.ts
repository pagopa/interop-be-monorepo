/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, operationForbidden, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  mailAlreadyExists,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/mails test", () => {
  const tenant: Tenant = getMockTenant();
  const mailSeed: tenantApi.MailSeed = {
    kind: "CONTACT_EMAIL",
    address: "testMail@test.it",
    description: "mail description",
  };

  beforeEach(() => {
    tenantService.addTenantMail = vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (token: string, data: object = mailSeed) =>
    request(api)
      .post(`/tenants/${tenant.id}/mails`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.addTenantMail = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    tenantService.addTenantMail = vi.fn().mockRejectedValue(operationForbidden);
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for mailAlreadyExists", async () => {
    tenantService.addTenantMail = vi
      .fn()
      .mockRejectedValue(mailAlreadyExists());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid mail seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      kind: "CONTACT_EMAIL",
      description: "mail description",
    });
    expect(res.status).toBe(400);
  });
});
