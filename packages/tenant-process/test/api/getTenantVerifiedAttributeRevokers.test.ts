/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, TenantId, AttributeId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API GET /tenants/{tenantId}/attributes/verified/{attributeId}/revokers test", () => {
  const tenantId: TenantId = generateId();
  const attributeId: AttributeId = generateId();
  const limit = 10;
  const offset = 0;

  const mockRevokers = [
    {
      id: generateId(),
      verificationDate: new Date().toISOString(),
      expirationDate: new Date().toISOString(),
      extensionDate: undefined,
      revocationDate: new Date().toISOString(),
      delegationId: undefined,
    },
  ];

  const serviceResponse = {
    results: mockRevokers,
    totalCount: 1,
  };

  beforeEach(() => {
    tenantService.getTenantVerifiedAttributeRevokers = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const unauthorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.INTERNAL_ROLE,
  ];

  const makeRequest = async (
    token: string,
    requestTenantId: TenantId = tenantId,
    requestAttributeId: AttributeId = attributeId,
    queryParams = { limit, offset }
  ) =>
    request(api)
      .get(
        `/tenants/${requestTenantId}/attributes/verified/${requestAttributeId}/revokers`
      )
      .query(queryParams)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(serviceResponse);
      expect(
        tenantService.getTenantVerifiedAttributeRevokers
      ).toHaveBeenCalledWith(
        tenantId,
        attributeId,
        { offset, limit },
        expect.objectContaining({
          logger: expect.any(Object),
        })
      );
    }
  );

  it.each(unauthorizedRoles)(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(403);
    }
  );

  it("Should return 200 with empty results when no revokers exist", async () => {
    const emptyResponse = { results: [], totalCount: 0 };
    tenantService.getTenantVerifiedAttributeRevokers = vi
      .fn()
      .mockResolvedValue(emptyResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyResponse);
  });

  it("Should handle pagination parameters correctly", async () => {
    const customOffset = 5;
    const customLimit = 20;
    const token = generateToken(authRole.M2M_ROLE);

    await makeRequest(token, tenantId, attributeId, {
      offset: customOffset,
      limit: customLimit,
    });

    expect(
      tenantService.getTenantVerifiedAttributeRevokers
    ).toHaveBeenCalledWith(
      tenantId,
      attributeId,
      { offset: customOffset, limit: customLimit },
      expect.objectContaining({
        logger: expect.any(Object),
      })
    );
  });
});
