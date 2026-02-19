/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { catalogApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import {
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /eservices/{eServiceId}/descriptors/{descriptorId}/declaredAttributes router test", () => {
  const attribute1: catalogApi.Attribute = {
    id: generateId(),
  };

  const attribute2: catalogApi.Attribute = {
    id: generateId(),
  };

  const attribute3: catalogApi.Attribute = {
    id: generateId(),
  };
  const bulkAttribute1: m2mGatewayApi.DeclaredAttribute = {
    id: attribute1.id,
    name: "Attribute Name 1",
    createdAt: new Date().toISOString(),
    description: "Description 1",
  };

  const bulkAttribute2: m2mGatewayApi.DeclaredAttribute = {
    id: attribute2.id,
    name: "Attribute Name 2",
    createdAt: new Date().toISOString(),
    description: "Description 2",
  };

  const bulkAttribute3: m2mGatewayApi.DeclaredAttribute = {
    id: attribute3.id,
    name: "Attribute Name 3",
    createdAt: new Date().toISOString(),
    description: "Description 3",
  };

  const descriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    attributes: {
      declared: [[attribute1, attribute2], [attribute3]],
      verified: [],
      certified: [],
    },
  };

  const eservice: catalogApi.EService = {
    ...getMockedApiEservice(),
    descriptors: [descriptor],
  };

  const results: m2mGatewayApi.EServiceDescriptorDeclaredAttribute[] = [
    {
      groupIndex: 0,
      attribute: bulkAttribute1,
    },
    {
      groupIndex: 0,
      attribute: bulkAttribute2,
    },
    {
      groupIndex: 1,
      attribute: bulkAttribute3,
    },
  ];

  const mockM2MEserviceDeclaredAttributesResponse: m2mGatewayApi.EServiceDescriptorDeclaredAttributes =
    {
      pagination: { offset: 0, limit: 10, totalCount: 3 },
      results,
    };

  const mockQueryParams: m2mGatewayApi.GetDeclaredAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  mockEserviceService.getEserviceDescriptorDeclaredAttributes = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceDeclaredAttributesResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string = eservice.id,
    descriptorId: string = descriptor.id,
    query: m2mGatewayApi.GetDeclaredAttributesQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/declaredAttributes`
      )
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEserviceDeclaredAttributesResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
  it.each([
    {
      error: eserviceDescriptorNotFound(eservice.id, descriptor.id),
      expectedStatus: 404,
    },
    {
      error: eserviceDescriptorAttributeNotFound(descriptor.id),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      mockEserviceService.getEserviceDescriptorDeclaredAttributes = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), generateId());
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      query as m2mGatewayApi.GetDeclaredAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      results: [
        {
          ...mockM2MEserviceDeclaredAttributesResponse.results[0],
          id: "invalid",
        },
      ],
    },
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      results: [
        {
          ...mockM2MEserviceDeclaredAttributesResponse.results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      results: [
        {
          ...mockM2MEserviceDeclaredAttributesResponse.results[0],
          groupIndex: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      results: [
        {
          ...mockM2MEserviceDeclaredAttributesResponse.results[0],
          groupIndex: -1,
        },
      ],
    },
    {
      ...mockM2MEserviceDeclaredAttributesResponse,
      results: [
        {
          ...mockM2MEserviceDeclaredAttributesResponse.results[0],
          groupIndex: "a string",
        },
      ],
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEserviceDescriptorDeclaredAttributes = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eservice.id,
        descriptor.id,
        mockQueryParams
      );
      expect(res.status).toBe(500);
    }
  );
});
