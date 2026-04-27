/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("API GET /purposeTemplates/:purposeTemplateId/eserviceTemplates", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = generateId(),
    query: m2mGatewayApiV3.GetPurposeTemplateEServiceTemplatesQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/eserviceTemplates`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .query(query)
      .send();

  const mockApiEServiceTemplate1 = getMockedApiEServiceTemplate();
  const mockApiEServiceTemplate2 = getMockedApiEServiceTemplate();
  const mockApiEServiceTemplate3 = getMockedApiEServiceTemplate();

  const mockM2MPurposeTemplateEServiceTemplatesResponse: m2mGatewayApiV3.EServiceTemplates =
    {
      pagination: { offset: 0, limit: 10, totalCount: 3 },
      results: [
        toM2MGatewayEServiceTemplate(mockApiEServiceTemplate1),
        toM2MGatewayEServiceTemplate(mockApiEServiceTemplate2),
        toM2MGatewayEServiceTemplate(mockApiEServiceTemplate3),
      ],
    };

  const mockQueryParams: m2mGatewayApiV3.GetPurposeTemplateEServiceTemplatesQueryParams =
    {
      offset: 0,
      limit: 10,
      eserviceTemplateName: generateMock(z.string().optional()),
      creatorIds: [generateId(), generateId()],
    };

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getPurposeTemplateEServiceTemplates = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateEServiceTemplatesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplateEServiceTemplatesResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 200 with empty results when no templates are linked", async () => {
    const emptyResponse: m2mGatewayApiV3.EServiceTemplates = {
      pagination: { offset: 0, limit: 10, totalCount: 0 },
      results: [],
    };
    mockPurposeTemplateService.getPurposeTemplateEServiceTemplates = vi
      .fn()
      .mockResolvedValue(emptyResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyResponse);
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 10 } },
    { query: { offset: -1, limit: 10 } },
    { query: { offset: 0, limit: -2 } },
    { query: { offset: 0, limit: 55 } },
    { query: { offset: "invalid", limit: 10 } },
    { query: { offset: 0, limit: "invalid" } },
    {
      query: {
        ...mockQueryParams,
        eserviceTemplateName: [1, 2, 3],
      },
    },
    {
      query: {
        ...mockQueryParams,
        creatorIds: [`${generateId()}`, "invalid"],
      },
    },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApiV3.GetPurposeTemplateEServiceTemplatesQueryParams
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MPurposeTemplateEServiceTemplatesResponse,
      results: [
        {
          ...mockM2MPurposeTemplateEServiceTemplatesResponse.results[0],
          id: undefined,
        },
      ],
    },
    {
      ...mockM2MPurposeTemplateEServiceTemplatesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.getPurposeTemplateEServiceTemplates = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
