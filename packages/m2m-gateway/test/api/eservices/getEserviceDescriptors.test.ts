import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";

describe("GET /eservices/:eserviceId/descriptors router test", () => {
  const mockApiEserviceDescriptor1 = getMockedApiEserviceDescriptor();
  const mockApiEserviceDescriptor2 = getMockedApiEserviceDescriptor();

  const mockM2MEserviceDescriptorsResponse: m2mGatewayApi.EServiceDescriptors =
    {
      pagination: { offset: 0, limit: 10, totalCount: 2 },
      results: [
        toM2MGatewayApiEServiceDescriptor(mockApiEserviceDescriptor1),
        toM2MGatewayApiEServiceDescriptor(mockApiEserviceDescriptor2),
      ],
    };

  const mockQueryParams: m2mGatewayApi.GetEServiceDescriptorsQueryParams = {
    state: "PUBLISHED",
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    eserviceId: string,
    query: m2mGatewayApi.GetEServiceDescriptorsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/${eserviceId}/descriptors`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceDescriptors = vi
        .fn()
        .mockResolvedValue(mockM2MEserviceDescriptorsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDescriptorsResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockQueryParams);
    expect(res.status).toBe(403);
  });
  it.each([
    {},
    { ...mockQueryParams, state: "invalidState" },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApi.GetEServicesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceDescriptorsResponse,
      results: [
        {
          ...mockM2MEserviceDescriptorsResponse.results[0],
          state: "invalidState",
        },
      ],
    },
    {
      ...mockM2MEserviceDescriptorsResponse,
      results: [
        {
          ...mockM2MEserviceDescriptorsResponse.results[0],
          version: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceDescriptorsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEServiceDescriptors = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);
      expect(res.status).toBe(500);
    }
  );
});
