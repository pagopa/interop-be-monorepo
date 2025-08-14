import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateToken,
  getMockedApiVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantVerifiedAttribute } from "../../../src/api/tenantApiConverter.js";

const mockedTenantService = vi.mocked(mockTenantService);

describe("DELETE /tenants/:tenantId/verifiedAttributes/:attributeId route test", () => {
  beforeEach(() => {
    mockedTenantService.revokeTenantVerifiedAttribute.mockClear();
  });
  const tenantId = generateId();
  const attributeId = generateId();
  const agreementId = generateId();

  const mockTenantAttribute = getMockedApiVerifiedTenantAttribute();
  const mockResponse =
    toM2MGatewayApiTenantVerifiedAttribute(mockTenantAttribute);

  const makeRequest = async (
    token: string,
    tenantId: string,
    attributeId: string,
    agreementId?: string
  ) => {
    const url = `${appBasePath}/tenants/${tenantId}/verifiedAttributes/${attributeId}`;
    let req = request(api).delete(url).set("Authorization", `Bearer ${token}`);

    if (agreementId) {
      req = req.query({ agreementId });
    }

    return req;
  };

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const unauthorizedRoles: AuthRole[] = [authRole.API_ROLE];

  authorizedRoles.forEach((role) => {
    it(`should return 200 when revoking verified attribute with ${role} role`, async () => {
      const token = generateToken(role);
      mockedTenantService.revokeTenantVerifiedAttribute.mockResolvedValueOnce(
        mockResponse
      );

      const response = await makeRequest(token, tenantId, attributeId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(
        mockedTenantService.revokeTenantVerifiedAttribute
      ).toHaveBeenCalledWith(tenantId, attributeId, {}, expect.any(Object));
    });

    it(`should return 200 when revoking verified attribute with agreement ID with ${role} role`, async () => {
      const token = generateToken(role);
      mockedTenantService.revokeTenantVerifiedAttribute.mockResolvedValueOnce(
        mockResponse
      );

      const response = await makeRequest(
        token,
        tenantId,
        attributeId,
        agreementId
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(
        mockedTenantService.revokeTenantVerifiedAttribute
      ).toHaveBeenCalledWith(
        tenantId,
        attributeId,
        { agreementId },
        expect.any(Object)
      );
    });
  });

  unauthorizedRoles.forEach((role) => {
    it(`should return 403 when revoking verified attribute with ${role} role`, async () => {
      const token = generateToken(role);

      const response = await makeRequest(token, tenantId, attributeId);

      expect(response.status).toBe(403);
      expect(
        mockedTenantService.revokeTenantVerifiedAttribute
      ).not.toHaveBeenCalled();
    });
  });

  it("should handle service errors", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const error = new Error("Service error");
    mockedTenantService.revokeTenantVerifiedAttribute.mockRejectedValueOnce(
      error
    );

    const response = await makeRequest(token, tenantId, attributeId);

    expect(response.status).toBe(500);
    expect(
      mockedTenantService.revokeTenantVerifiedAttribute
    ).toHaveBeenCalledWith(tenantId, attributeId, {}, expect.any(Object));
  });
});
