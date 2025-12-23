/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId, tenantKind } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";

describe("API GET /purposeTemplates router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetPurposeTemplatesQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockPurposeTemplate1 = getMockedApiPurposeTemplate();
  const mockPurposeTemplate2 = getMockedApiPurposeTemplate();
  const mockPurposeTemplate3 = getMockedApiPurposeTemplate();

  const mockM2MPurposeTemplatesResponse: m2mGatewayApiV3.PurposeTemplates = {
    results: [
      toM2MGatewayApiPurposeTemplate(mockPurposeTemplate1),
      toM2MGatewayApiPurposeTemplate(mockPurposeTemplate2),
      toM2MGatewayApiPurposeTemplate(mockPurposeTemplate3),
    ],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const mockQueryParams: m2mGatewayApiV3.GetPurposeTemplatesQueryParams = {
    offset: 0,
    limit: 10,
    purposeTitle: generateMock(z.string()),
    eserviceIds: [generateId()],
    creatorIds: [generateId(), generateId()],
    states: [
      m2mGatewayApiV3.PurposeTemplateState.Enum.PUBLISHED,
      m2mGatewayApiV3.PurposeTemplateState.Enum.DRAFT,
    ],
    targetTenantKind: tenantKind.PA,
    handlesPersonalData: false,
  };

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getPurposeTemplates = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplatesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplatesResponse);
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
        eserviceIds: [`${generateId()}`, "invalid"],
      },
    },
    {
      query: { ...mockQueryParams, creatorIds: [`${generateId()}`, "invalid"] },
    },
    {
      query: {
        ...mockQueryParams,
        states: [m2mGatewayApiV3.PurposeTemplateState.Enum.PUBLISHED, "invalid"],
      },
    },
    { query: { ...mockQueryParams, targetTenantKind: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApiV3.GetPurposeTemplatesQueryParams
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MPurposeTemplatesResponse,
      results: [
        {
          ...mockM2MPurposeTemplatesResponse.results[0],
          purposeIsFreeOfCharge: "YES",
        },
      ],
    },
    {
      ...mockM2MPurposeTemplatesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response: %s",
    async (resp) => {
      mockPurposeTemplateService.getPurposeTemplates = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
