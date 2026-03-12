import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAttribute,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { attributeNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";

describe("GET /verifiedAttributes/:attributeId router test", () => {
  const mockApiVerifiedAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.VERIFIED,
  });
  const mockM2MVerifiedAttributeResponse: m2mGatewayApiV3.VerifiedAttribute =
    toM2MGatewayApiVerifiedAttribute({
      attribute: mockApiVerifiedAttribute,
      logger: genericLogger,
    });

  const makeRequest = async (token: string, attributeId: string) =>
    request(api)
      .get(`${appBasePath}/verifiedAttributes/${attributeId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.getVerifiedAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MVerifiedAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiVerifiedAttribute.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MVerifiedAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiVerifiedAttribute.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it("Should return 404 in case of attributeNotFound error", async () => {
    mockAttributeService.getVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(mockApiVerifiedAttribute));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiVerifiedAttribute.id);

    expect(res.status).toBe(404);
  });

  it.each([
    { ...mockM2MVerifiedAttributeResponse, kind: "invalidKind" },
    { ...mockM2MVerifiedAttributeResponse, invalidParam: "invalidValue" },
    { ...mockM2MVerifiedAttributeResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.getVerifiedAttribute = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiVerifiedAttribute.id);

      expect(res.status).toBe(500);
    }
  );
});
