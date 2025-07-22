import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eserviceTemplates/:templateId/versions router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetEServiceTemplateVersionsQueryParams,
    templateId: string
  ) =>
    request(api)
      .get(`${appBasePath}/eserviceTemplates/${templateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: "DRAFT",
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: "DEPRECATED",
  });

  const mockApiTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiTemplateVersion1, mockApiTemplateVersion2],
  });

  const mockM2MVersion1 = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion1
  );
  const mockM2MVersion2 = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion2
  );

  const mockM2MVersionsResponse: m2mGatewayApi.EServiceTemplateVersions = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [mockM2MVersion1, mockM2MVersion2],
  };

  const mockParams: m2mGatewayApi.GetEServiceTemplateVersionsQueryParams = {
    state: undefined,
    offset: 0,
    limit: 10,
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.getEServiceTemplateVersions = vi
        .fn()
        .mockResolvedValue(mockM2MVersionsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockParams, mockApiTemplate.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MVersionsResponse);
    }
  );

  it.each([
    {},
    { ...mockParams, offset: -2 },
    { ...mockParams, limit: 100 },
    { ...mockParams, offset: "invalidOffset" },
    { ...mockParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApi.GetEServiceTemplateVersionsQueryParams,
      mockApiTemplate.id
    );

    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockParams, mockApiTemplate.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      ...mockM2MVersionsResponse,
      results: [
        ...mockM2MVersionsResponse.results,
        { ...mockApiTemplateVersion1, createdAt: undefined },
      ],
    },
    {
      ...mockM2MVersionsResponse,
      results: [
        ...mockM2MVersionsResponse.results,
        { ...mockApiTemplateVersion1, invalidParam: "invalidValue" },
      ],
    },
    {
      ...mockM2MVersionsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateVersions = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockParams, mockApiTemplate.id);

      expect(res.status).toBe(500);
    }
  );
});
