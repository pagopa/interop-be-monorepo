import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { generateId, operationForbidden } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tenantContactNotFound } from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("GET /tenants/{tenantId}/contact", () => {
  const path = `/tenants/${mockTokenOrganizationId}/contact`;
  beforeEach(() => {
    tenantService.getTenantContact = vi
      .fn()
      .mockResolvedValue({ address: "member@example.org" });
  });
  it("forwards the authenticated tenant identity for a UI reader", async () => {
    const res = await request(api)
      .get(path)
      .set("Authorization", `Bearer ${generateToken(authRole.VIEWER_ROLE)}`)
      .set("X-Correlation-Id", generateId());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ address: "member@example.org" });
    expect(tenantService.getTenantContact).toHaveBeenCalledWith(
      mockTokenOrganizationId,
      expect.objectContaining({
        authData: expect.objectContaining({
          organizationId: mockTokenOrganizationId,
        }),
      })
    );
  });
  it.each([
    authRole.INTERNAL_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.MAINTENANCE_ROLE,
  ])("rejects system role %s", async (role) => {
    const res = await request(api)
      .get(path)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId());
    expect(res.status).toBe(403);
    expect(tenantService.getTenantContact).not.toHaveBeenCalled();
  });
  it.each([
    [operationForbidden, 403],
    [tenantContactNotFound(mockTokenOrganizationId), 404],
  ] as const)(
    "maps the domain error to its HTTP status",
    async (error, status) => {
      tenantService.getTenantContact = vi.fn().mockRejectedValue(error);
      const res = await request(api)
        .get(path)
        .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
        .set("X-Correlation-Id", generateId());
      expect(res.status).toBe(status);
    }
  );
});
