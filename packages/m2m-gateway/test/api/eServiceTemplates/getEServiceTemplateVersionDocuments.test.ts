/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEserviceDoc,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiDocument } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("GET /eserviceTemplates/:templateId/descriptor/:versionId/documents route test", () => {
  const mockResponse: m2mGatewayApi.Documents = {
    results: [getMockedApiEserviceDoc(), getMockedApiEserviceDoc()].map(
      toM2MGatewayApiDocument
    ),
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 2,
    },
  };

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId,
    versionId: EServiceTemplateVersionId,
    query: m2mGatewayApi.GetEServiceTemplateVersionDocumentsQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/documents`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockQueryParams: m2mGatewayApi.GetEServiceTemplateVersionDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.getEServiceTemplateVersionDocuments = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockQueryParams
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      mockQueryParams
    );
    expect(res.status).toBe(403);
  });

  it("should return 400 if passed an invalid eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalidEServiceId" as EServiceTemplateId,
      generateId(),
      mockQueryParams
    );

    expect(res.status).toBe(400);
  });

  it("should return 400 if passed an invalid eservice template version id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "invalidEServiceId" as EServiceTemplateVersionId,
      mockQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      query as unknown as m2mGatewayApi.GetEServiceTemplateVersionDocumentsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], createdAt: "invalidDate" }],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], createdAt: undefined }],
    },
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], invalidField: "invalidValue" }],
    },
    {
      ...mockResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.getEServiceTemplateVersionDocuments = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockQueryParams
      );

      expect(res.status).toBe(500);
    }
  );
});
