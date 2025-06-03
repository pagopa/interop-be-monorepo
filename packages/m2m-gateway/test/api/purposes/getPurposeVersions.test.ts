import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "pagopa-interop-commons-test";

describe("GET /purposes/:purposeId/versions router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetPurposeVersionsQueryParams,
    purposeId: string
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiPurposeVersion1 = getMockedApiPurposeVersion();
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: "ACTIVE",
  });

  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
  });

  const mockM2MPurposesResponse: m2mGatewayApi.PurposeVersions = {
    pagination: { offset: 0, limit: 10, totalCount: 1 },
    results: [mockApiPurposeVersion2],
  };

  const mockParams: m2mGatewayApi.GetPurposeVersionsQueryParams = {
    state: "ACTIVE",
    offset: 0,
    limit: 10,
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposeVersions = vi
        .fn()
        .mockResolvedValue(mockM2MPurposesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockParams, mockApiPurpose.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposesResponse);
    }
  );

  it.each([
    { ...mockParams, offset: -2 },
    { ...mockParams, limit: 100 },
    { ...mockParams, offset: "invalidOffset" },
    { ...mockParams, limit: "invalidLimit" },
    { ...mockParams, state: "invalidState" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApi.GetPurposeVersionsQueryParams,
      mockApiPurpose.id
    );

    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockParams, mockApiPurpose.id);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      ...mockM2MPurposesResponse,
      results: [
        ...mockM2MPurposesResponse.results,
        { ...mockApiPurposeVersion1, createdAt: undefined },
      ],
    },
    {
      ...mockM2MPurposesResponse,
      results: [
        ...mockM2MPurposesResponse.results,
        { ...mockApiPurposeVersion1, invalidParam: "invalidValue" },
      ],
    },
    {
      ...mockM2MPurposesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.getPurposeVersions = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockParams, mockApiPurpose.id);

      expect(res.status).toBe(500);
    }
  );
});
