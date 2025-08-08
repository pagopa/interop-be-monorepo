import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateToken,
  getMockedApiDeclaredTenantAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantDeclaredAttribute } from "../../../src/api/tenantApiConverter.js";

const mockedTenantService = vi.mocked(mockTenantService);

describe("POST /tenants/:tenantId/declaredAttributes route test", () => {
  beforeEach(() => {
    mockedTenantService.addTenantDeclaredAttribute.mockClear();
  });

  const mockBody: m2mGatewayApi.AddDeclaredAttributeRequest = {
    id: generateId(),
    delegationId: generateId(),
  };

  const mockTenantAttribute = getMockedApiDeclaredTenantAttribute();
  const mockResponse =
    toM2MGatewayApiTenantDeclaredAttribute(mockTenantAttribute);

  const makeRequest = async (
    token: string,
    tenantId: string,
    body: m2mGatewayApi.AddDeclaredAttributeRequest
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/declaredAttributes`)
      .send(body)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const unauthorizedRoles: AuthRole[] = [authRole.API_ROLE];

  authorizedRoles.forEach((role) => {
    it(`should return 200 when adding declared attribute with ${role} role`, async () => {
      const token = generateToken(role);
      mockedTenantService.addTenantDeclaredAttribute.mockResolvedValueOnce(
        mockResponse
      );

      const response = await makeRequest(token, generateId(), mockBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(
        mockedTenantService.addTenantDeclaredAttribute
      ).toHaveBeenCalledWith(expect.any(String), mockBody, expect.any(Object));
    });
  });

  unauthorizedRoles.forEach((role) => {
    it(`should return 403 when adding declared attribute with ${role} role`, async () => {
      const token = generateToken(role);

      const response = await makeRequest(token, generateId(), mockBody);

      expect(response.status).toBe(403);
      expect(
        mockedTenantService.addTenantDeclaredAttribute
      ).not.toHaveBeenCalled();
    });
  });

  it("should return 400 with invalid body", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const invalidBody = { invalidField: "value" };

    const response = await request(api)
      .post(`${appBasePath}/tenants/${generateId()}/declaredAttributes`)
      .send(invalidBody)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(
      mockedTenantService.addTenantDeclaredAttribute
    ).not.toHaveBeenCalled();
  });

  it("should handle service errors", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const error = new Error("Service error");
    mockedTenantService.addTenantDeclaredAttribute.mockRejectedValueOnce(error);

    const response = await makeRequest(token, generateId(), mockBody);

    expect(response.status).toBe(500);
    expect(mockedTenantService.addTenantDeclaredAttribute).toHaveBeenCalledWith(
      expect.any(String),
      mockBody,
      expect.any(Object)
    );
  });
});
