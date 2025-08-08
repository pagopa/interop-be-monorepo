import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateToken,
  getMockedApiDeclaredTenantAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantDeclaredAttribute } from "../../../src/api/tenantApiConverter.js";

const mockedTenantService = vi.mocked(mockTenantService);

describe("DELETE /tenants/:tenantId/declaredAttributes/:attributeId route test", () => {
  beforeEach(() => {
    mockedTenantService.revokeTenantDeclaredAttribute.mockClear();
  });

  const tenantId = generateId();
  const attributeId = generateId();
  const delegationId = generateId();

  const mockTenantAttribute = getMockedApiDeclaredTenantAttribute({
    revoked: true,
  });
  const mockResponse =
    toM2MGatewayApiTenantDeclaredAttribute(mockTenantAttribute);

  const makeRequest = async (
    token: string,
    tenantId: string,
    attributeId: string,
    delegationId?: string
  ) => {
    const url = `${appBasePath}/tenants/${tenantId}/declaredAttributes/${attributeId}`;
    let req = request(api).delete(url).set("Authorization", `Bearer ${token}`);

    if (delegationId) {
      req = req.query({ delegationId });
    }

    return req;
  };

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const unauthorizedRoles: AuthRole[] = [authRole.API_ROLE];

  authorizedRoles.forEach((role) => {
    it(`should return 200 when revoking declared attribute with ${role} role`, async () => {
      const token = generateToken(role);
      mockedTenantService.revokeTenantDeclaredAttribute.mockResolvedValueOnce(
        mockResponse
      );

      const response = await makeRequest(token, tenantId, attributeId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(
        mockedTenantService.revokeTenantDeclaredAttribute
      ).toHaveBeenCalledWith(tenantId, attributeId, {}, expect.any(Object));
    });

    it(`should return 200 when revoking declared attribute with delegation ID with ${role} role`, async () => {
      const token = generateToken(role);
      mockedTenantService.revokeTenantDeclaredAttribute.mockResolvedValueOnce(
        mockResponse
      );

      const response = await makeRequest(
        token,
        tenantId,
        attributeId,
        delegationId
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(
        mockedTenantService.revokeTenantDeclaredAttribute
      ).toHaveBeenCalledWith(
        tenantId,
        attributeId,
        { delegationId },
        expect.any(Object)
      );
    });
  });

  unauthorizedRoles.forEach((role) => {
    it(`should return 403 when revoking declared attribute with ${role} role`, async () => {
      const token = generateToken(role);

      const response = await makeRequest(token, tenantId, attributeId);

      expect(response.status).toBe(403);
      expect(
        mockedTenantService.revokeTenantDeclaredAttribute
      ).not.toHaveBeenCalled();
    });
  });

  it("should handle service errors", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const error = new Error("Service error");
    mockedTenantService.revokeTenantDeclaredAttribute.mockRejectedValueOnce(
      error
    );

    const response = await makeRequest(token, tenantId, attributeId);

    expect(response.status).toBe(500);
    expect(
      mockedTenantService.revokeTenantDeclaredAttribute
    ).toHaveBeenCalledWith(tenantId, attributeId, {}, expect.any(Object));
  });
});
