import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { attributeNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";

describe("GET /declaredAttributes/:attributeId router test", () => {
  const mockApiDeclaredAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.DECLARED,
  });
  const mockM2MDeclaredAttributeResponse: m2mGatewayApi.DeclaredAttribute =
    toM2MGatewayApiDeclaredAttribute({
      attribute: mockApiDeclaredAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (token: string, attributeId: string) =>
    request(api)
      .get(`${appBasePath}/declaredAttributes/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.getDeclaredAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MDeclaredAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiDeclaredAttribute.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MDeclaredAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiDeclaredAttribute.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it("Should return 404 in case of attributeNotFound error", async () => {
    mockAttributeService.getDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(mockApiDeclaredAttribute));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiDeclaredAttribute.id);

    expect(res.status).toBe(404);
  });

  it.each([
    { ...mockM2MDeclaredAttributeResponse, kind: "invalidKind" },
    { ...mockM2MDeclaredAttributeResponse, invalidParam: "invalidValue" },
    { ...mockM2MDeclaredAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.getDeclaredAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiDeclaredAttribute.id);

      expect(res.status).toBe(500);
    }
  );
});
