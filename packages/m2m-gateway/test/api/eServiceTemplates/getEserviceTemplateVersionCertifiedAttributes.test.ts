/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import {
  eserviceTemplateVersionAttributeNotFound,
  eserviceTemplateVersionNotFound,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /eserviceTemplates/{templateId}/versions/{versionId}/certifiedAttributes router test", () => {
  const attribute1: eserviceTemplateApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute2: eserviceTemplateApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };

  const attribute3: eserviceTemplateApi.Attribute = {
    id: generateId(),
    explicitAttributeVerification: false,
  };
  const bulkAttribute1: m2mGatewayApi.CertifiedAttribute = {
    code: "code1",
    id: attribute1.id,
    name: "Attribute Name 1",
    createdAt: new Date().toISOString(),
    description: "Description 1",
    origin: "Origin 1",
  };

  const bulkAttribute2: m2mGatewayApi.CertifiedAttribute = {
    code: "code2",
    id: attribute2.id,
    name: "Attribute Name 2",
    createdAt: new Date().toISOString(),
    description: "Description 2",
    origin: "Origin 2",
  };

  const bulkAttribute3: m2mGatewayApi.CertifiedAttribute = {
    code: "code3",
    id: attribute3.id,
    name: "Attribute Name 3",
    createdAt: new Date().toISOString(),
    description: "Description 3",
    origin: "Origin 3",
  };

  const version: eserviceTemplateApi.EServiceTemplateVersion = {
    ...getMockedApiEserviceTemplateVersion(),
    attributes: {
      certified: [[attribute1, attribute2], [attribute3]],
      verified: [],
      declared: [],
    },
  };

  const eserviceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [version],
  };

  const results: m2mGatewayApi.EServiceTemplateVersionCertifiedAttribute[] = [
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

  const mockM2MEserviceTemplateVersionCertifiedAttributesResponse: m2mGatewayApi.EServiceTemplateVersionCertifiedAttributes =
    {
      pagination: { offset: 0, limit: 10, totalCount: 3 },
      results,
    };

  const mockQueryParams: m2mGatewayApi.GetEServiceTemplateVersionCertifiedAttributesQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  mockEServiceTemplateService.getEserviceTemplateVersionCertifiedAttributes = vi
    .fn()
    .mockResolvedValue(
      mockM2MEserviceTemplateVersionCertifiedAttributesResponse
    );

  const makeRequest = async (
    token: string,
    templateId: string = eserviceTemplate.id,
    versionId: string = version.id,
    query: m2mGatewayApi.GetEServiceTemplateVersionCertifiedAttributesQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/certifiedAttributes`
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
      expect(res.body).toEqual(
        mockM2MEserviceTemplateVersionCertifiedAttributesResponse
      );
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
      error: eserviceTemplateVersionNotFound(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(version.id)
      ),
      expectedStatus: 404,
    },
    {
      error: eserviceTemplateVersionAttributeNotFound(version.id),
      expectedStatus: 500,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      mockEServiceTemplateService.getEserviceTemplateVersionCertifiedAttributes =
        vi.fn().mockRejectedValue(error);
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
      query as m2mGatewayApi.GetEServiceTemplateVersionCertifiedAttributesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse
            .results[0],
          id: "invalid",
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse
            .results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse
            .results[0],
          groupIndex: undefined,
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse
            .results[0],
          groupIndex: -1,
        },
      ],
    },
    {
      ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse,
      results: [
        {
          ...mockM2MEserviceTemplateVersionCertifiedAttributesResponse
            .results[0],
          groupIndex: "a string",
        },
      ],
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEserviceTemplateVersionCertifiedAttributes =
        vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eserviceTemplate.id,
        version.id,
        mockQueryParams
      );
      expect(res.status).toBe(500);
    }
  );
});
