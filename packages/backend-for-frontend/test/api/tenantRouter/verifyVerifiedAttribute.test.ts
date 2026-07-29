/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { TenantId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiVerifiedTenantAttributeSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /tenants/{tenantId}/attributes/verified test", () => {
  const attributeSeed = getMockBffApiVerifiedTenantAttributeSeed();

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.verifyVerifiedAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    body: bffApi.VerifiedTenantAttributeSeed = attributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/attributes/verified`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { ...attributeSeed, id: undefined } },
    { body: { ...attributeSeed, id: "invalid" } },
    { body: { ...attributeSeed, agreementId: undefined } },
    { body: { ...attributeSeed, agreementId: "invalid" } },
    { body: { ...attributeSeed, expirationDate: "invalid" } },
    { body: { ...attributeSeed, extraField: true } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as bffApi.VerifiedTenantAttributeSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
