/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEserviceDoc,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiDocument } from "../../../src/api/eserviceApiConverter.js";

describe("GET /eservices/:eserviceId/descriptor/:descriptorId/documents route test", () => {
  const mockResponse: m2mGatewayApiV3.Documents = {
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
    eserviceId: EServiceId,
    descriptorId: DescriptorId,
    query: m2mGatewayApiV3.GetEServiceDescriptorDocumentsQueryParams
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/documents`
      )
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockQueryParams: m2mGatewayApiV3.GetEServiceDescriptorDocumentsQueryParams =
  {
    offset: 0,
    limit: 10,
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceDescriptorDocuments = vi
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

  it("should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "invalidEServiceId" as EServiceId,
      generateId(),
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
      query as unknown as m2mGatewayApiV3.GetEServiceDescriptorDocumentsQueryParams
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
      mockEserviceService.getEServiceDescriptorDocuments = vi
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
