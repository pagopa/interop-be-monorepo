/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  generateId,
  operationForbidden,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
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

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: tenantApi.MailSeed = mailSeed
  ) =>
    request(api)
      .post(`/tenants/${tenantId}/mails`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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

  it.each([
    { error: tenantNotFound(tenant.id), expectedStatus: 404 },
    { error: operationForbidden, expectedStatus: 403 },
    { error: mailAlreadyExists(), expectedStatus: 409 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.addTenantMail = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { ...mailSeed, address: "" } },
    { body: { ...mailSeed, extraField: 1 } },
    { body: { kind: "CONTACT_EMAIL", description: "mail description" } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as tenantApi.MailSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
