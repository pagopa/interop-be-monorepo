/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockedApiEServiceDescriptorPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /purposeTemplates/:purposeTemplateId/eservices", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = generateId(),
    query: m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams = mockQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates/${purposeTemplateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockPurposeTemplateEServiceDescriptor1 =
    getMockedApiEServiceDescriptorPurposeTemplate();
  const mockPurposeTemplateEServiceDescriptor2 =
    getMockedApiEServiceDescriptorPurposeTemplate();
  const mockPurposeTemplateEServiceDescriptor3 =
    getMockedApiEServiceDescriptorPurposeTemplate();

  const mockM2MPurposeTemplateEServiceDescriptorsResponse: m2mGatewayApi.EServiceDescriptorsPurposeTemplate =
    {
      results: [
        mockPurposeTemplateEServiceDescriptor1,
        mockPurposeTemplateEServiceDescriptor2,
        mockPurposeTemplateEServiceDescriptor3,
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 3,
      },
    };

  const mockQueryParams: m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams =
    {
      offset: 0,
      limit: 10,
      eserviceName: generateMock(z.string().optional()),
      producerIds: [generateId(), generateId()],
    };

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      mockPurposeTemplateService.getPurposeTemplateEServiceDescriptors = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateEServiceDescriptorsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        mockM2MPurposeTemplateEServiceDescriptorsResponse
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
        eserviceName: [1, 2, 3],
      },
    },
    {
      query: {
        ...mockQueryParams,
        producerIds: [`${generateId()}`, "invalid"],
      },
    },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApi.GetPurposeTemplateEServiceDescriptorsQueryParams
    );
    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MPurposeTemplateEServiceDescriptorsResponse,
      results: [
        {
          ...mockM2MPurposeTemplateEServiceDescriptorsResponse.results[0],
          createdAt: undefined,
        },
      ],
    },
    {
      ...mockM2MPurposeTemplateEServiceDescriptorsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.getPurposeTemplateEServiceDescriptors = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
