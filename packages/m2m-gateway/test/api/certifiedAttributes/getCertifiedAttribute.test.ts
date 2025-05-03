/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { api, mockAttributeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  attributeNotFound,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../../src/model/errors.js";
import { getMockedApiAttribute } from "../../mockUtils.js";
import { toM2MGatewayApiCertifiedAttribute } from "../../../src/api/attributeApiConverter.js";

describe("GET /certifiedAttribute router test", () => {
  const mockApiCertifiedAttribute = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
  });
  const mockM2MCertifiedAttributeResponse: m2mGatewayApi.CertifiedAttribute =
    toM2MGatewayApiCertifiedAttribute(mockApiCertifiedAttribute.data);

  const makeRequest = async (token: string, attributeId: string) =>
    request(api)
      .get(`${appBasePath}/certifiedAttributes/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockAttributeService.getCertifiedAttribute = vi
        .fn()
        .mockResolvedValue(mockM2MCertifiedAttributeResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiCertifiedAttribute.data.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MCertifiedAttributeResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiCertifiedAttribute.data.id);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId");

    expect(res.status).toBe(400);
  });

  it("Should return 404 in case of attributeNotFound error", async () => {
    mockAttributeService.getCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(mockApiCertifiedAttribute.data));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiCertifiedAttribute.data.id);

    expect(res.status).toBe(404);
  });

  it("Should return 500 in case of unexpectedUndefinedAttributeOriginOrCode error", async () => {
    mockAttributeService.getCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        unexpectedUndefinedAttributeOriginOrCode(mockApiCertifiedAttribute.data)
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiCertifiedAttribute.data.id);

    expect(res.status).toBe(500);
  });
});
