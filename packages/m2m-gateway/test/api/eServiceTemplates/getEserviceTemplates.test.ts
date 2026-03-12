import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eserviceTemplates router test", () => {
  const mockApiTemplate1 = getMockedApiEServiceTemplate();
  const mockApiTemplate2 = getMockedApiEServiceTemplate();
  const mockM2MEServiceTemplatesResponse: m2mGatewayApi.EServiceTemplates = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayEServiceTemplate(mockApiTemplate1),
      toM2MGatewayEServiceTemplate(mockApiTemplate2),
    ],
  };

  const mockQueryParams: m2mGatewayApi.GetEServiceTemplatesQueryParams = {
    offset: 0,
    limit: 10,
    eserviceTemplateIds: [mockApiTemplate1.id, mockApiTemplate2.id],
    creatorIds: [],
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetEServiceTemplatesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/eserviceTemplates`)
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
      mockEServiceTemplateService.getEServiceTemplates = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceTemplatesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServiceTemplatesResponse);
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
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
    { ...mockQueryParams, eserviceTemplateIds: ["invalidTemplateId"] },
    { ...mockQueryParams, creatorIds: ["invalidCreatorsId"] },
    { ...mockQueryParams, offset: undefined },
    { ...mockQueryParams, limit: undefined },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetEServiceTemplatesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEServiceTemplatesResponse,
      results: [
        {
          ...mockM2MEServiceTemplatesResponse.results[0],
          states: ["invalidState"],
        },
      ],
    },
    {
      ...mockM2MEServiceTemplatesResponse,
      results: [
        {
          ...mockM2MEServiceTemplatesResponse.results[0],
          eserviceTemplatesIds: ["invalidTemplateId"],
        },
      ],
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplates = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
