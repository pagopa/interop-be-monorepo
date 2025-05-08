/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bffApi } from "pagopa-interop-api-clients";
import { TenantId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiMailSeed } from "../../mockUtils.js";

describe("API POST /tenants/{tenantId}/mails test", () => {
  const mailSeed = getMockBffApiMailSeed();

  beforeEach(() => {
    clients.tenantProcessClient.tenant.addTenantMail = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    body: bffApi.MailSeed = mailSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/mails`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { tenantId: "invalid" },
    { body: {} },
    { body: { ...mailSeed, kind: undefined } },
    { body: { ...mailSeed, address: undefined } },
    { body: { ...mailSeed, kind: "invalid" } },
    { body: { ...mailSeed, extraField: true } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId as TenantId,
        body as bffApi.MailSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
