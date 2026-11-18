/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { AttributeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /tenants/attributes/declared/{attributeId} test", () => {
  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.revokeDeclaredAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    attributeId: AttributeId = generateId()
  ) =>
    request(api)
      .delete(`${appBasePath}/tenants/attributes/declared/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(
      clients.tenantProcessClient.tenantAttribute.revokeDeclaredAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        params: {
          tenantId: mockTokenOrganizationId,
          attributeId: expect.any(String),
        },
      })
    );
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as AttributeId);
    expect(res.status).toBe(400);
  });
});
