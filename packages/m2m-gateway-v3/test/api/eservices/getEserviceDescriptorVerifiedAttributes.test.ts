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
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import {
  eserviceDescriptorAttributeNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /eservices/{eServiceId}/descriptors/{descriptorId}/verifiedAttributes router test", () => {
  const attribute1: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute2: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute3: catalogApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };
  const bulkAttribute1: m2mGatewayApiV3.VerifiedAttribute = {
    id: attribute1.id,
    name: "Attribute Name 1",
    createdAt: new Date().toISOString(),
    description: "Description 1",
  };

  const bulkAttribute2: m2mGatewayApiV3.VerifiedAttribute = {
    id: attribute2.id,
    name: "Attribute Name 2",
    createdAt: new Date().toISOString(),
    description: "Description 2",
  };

  const bulkAttribute3: m2mGatewayApiV3.VerifiedAttribute = {
    id: attribute3.id,
    name: "Attribute Name 3",
    createdAt: new Date().toISOString(),
    description: "Description 3",
  };

  const descriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    attributes: {
      verified: [[attribute1, attribute2], [attribute3]],
      declared: [],
      certified: [],
    },
  };

  const eservice: catalogApi.EService = {
    ...getMockedApiEservice(),
    descriptors: [descriptor],
  };

  const results: m2mGatewayApiV3.EServiceDescriptorVerifiedAttribute[] = [
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

  const mockM2MEserviceVerifiedAttributesResponse: m2mGatewayApiV3.EServiceDescriptorVerifiedAttributes =
    {
      pagination: { offset: 0, limit: 10, totalCount: 3 },
      results,
    };

  const mockQueryParams: m2mGatewayApiV3.GetVerifiedAttributesQueryParams = {
    offset: 0,
    limit: 10,
  };

  mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
    .fn()
    .mockResolvedValue(mockM2MEserviceVerifiedAttributesResponse);

  const makeRequest = async (
    token: string,
    eserviceId: string = eservice.id,
    descriptorId: string = descriptor.id,
    query: m2mGatewayApiV3.GetVerifiedAttributesQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/verifiedAttributes`
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
      expect(res.body).toEqual(mockM2MEserviceVerifiedAttributesResponse);
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
      mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
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
      query as m2mGatewayApiV3.GetVerifiedAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceVerifiedAttributesResponse.results[0],
          id: "invalid",
        },
      ],
    },
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceVerifiedAttributesResponse.results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceVerifiedAttributesResponse.results[0],
          groupIndex: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceVerifiedAttributesResponse.results[0],
          groupIndex: -1,
        },
      ],
    },
    {
      ...mockM2MEserviceVerifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceVerifiedAttributesResponse.results[0],
          groupIndex: "a string",
        },
      ],
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.getEserviceDescriptorVerifiedAttributes = vi
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
