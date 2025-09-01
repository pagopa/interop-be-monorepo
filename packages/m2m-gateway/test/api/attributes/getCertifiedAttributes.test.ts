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
import { toM2MGatewayApiCertifiedAttribute } from "../../../src/api/attributeApiConverter.js";

describe("GET /certifiedAttributes router test", () => {
  const mockApiAttribute1 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
  });

  const mockApiAttribute2 = getMockedApiAttribute({
    kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
  });

  const mockCertifiedAttributesResponse: m2mGatewayApi.CertifiedAttributes = {
    results: [
      toM2MGatewayApiCertifiedAttribute({
        attribute: mockApiAttribute1,
        logger: genericLogger,
      }),
      toM2MGatewayApiCertifiedAttribute({
        attribute: mockApiAttribute2,
        logger: genericLogger,
      }),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const mockQueryParams: m2mGatewayApi.GetCertifiedAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetCertifiedAttributesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/certifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAttributeService.getCertifiedAttributes = vi
        .fn()
        .mockResolvedValue(mockCertifiedAttributesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockCertifiedAttributesResponse);
      expect(mockAttributeService.getCertifiedAttributes).toHaveBeenCalledWith(
        mockQueryParams,
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockQueryParams);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { ...mockQueryParams, offset: -1 },
    { ...mockQueryParams, limit: 0 },
    { ...mockQueryParams, limit: 51 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApi.GetCertifiedAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockCertifiedAttributesResponse,
      results: [
        { ...mockCertifiedAttributesResponse.results[0], code: undefined },
      ],
    },
    {
      ...mockCertifiedAttributesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAttributeService.getCertifiedAttributes = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
