/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { AttributeId, TenantId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /tenants/{tenantId}/attributes/verified/{attributeId} test", () => {
  const defaultBody: bffApi.revokeVerifiedAttribute_Body = {
    agreementId: generateId(),
    delegationId: generateId(),
  };

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    attributeId: AttributeId = generateId(),
    body: bffApi.revokeVerifiedAttribute_Body = defaultBody
  ) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${tenantId}/attributes/verified/${attributeId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(
      clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute
    ).toHaveBeenCalledWith(defaultBody, expect.anything());
  });

  it.each([
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
    { body: {} },
    { body: { agreementId: "invalid" } },
    { body: { ...defaultBody, delegationId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        attributeId,
        body as bffApi.revokeVerifiedAttribute_Body
      );
      expect(res.status).toBe(400);
    }
  );
});
