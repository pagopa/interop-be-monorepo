import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { getMockedApiPurpose } from "../../mockUtils.js";
import {
  missingActivePurposeVersion,
  purposeNotFound,
} from "../../../src/model/errors.js";

describe("GET /purposes router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetPurposesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockM2MPurposesResponse: m2mGatewayApi.Purposes = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiPurpose({
        purpose: mockApiPurpose1.data,
        logger: genericLogger,
      }),
      toM2MGatewayApiPurpose({
        purpose: mockApiPurpose2.data,
        logger: genericLogger,
      }),
    ],
  };

  const mockQueryParams: m2mGatewayApi.GetPurposesQueryParams = {
    offset: 0,
    limit: 10,
    eserviceIds: [],
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockPurposeService.getPurposes = vi
        .fn()
        .mockResolvedValue(mockM2MPurposesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposesResponse);
    }
  );

  it.each([
    { ...mockQueryParams, eservicesIds: ["invalidId"] },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApi.GetPurposesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, {
      offset: 0,
      limit: 10,
      eserviceIds: [],
    });
    expect(res.status).toBe(403);
  });

  it.each([
    {
      ...mockM2MPurposesResponse,
      results: [
        { ...mockM2MPurposesResponse.results[0], isFreeOfCharge: "YES" },
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
      mockPurposeService.getPurposes = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 404 in case of purposeNotFound error", async () => {
    mockPurposeService.getPurposes = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockApiPurpose1.data.id));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(404);
  });

  it("Should return 500 in case of missingActivePurposeVersion error", async () => {
    mockPurposeService.getPurposes = vi
      .fn()
      .mockRejectedValue(missingActivePurposeVersion(mockApiPurpose1.data.id));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
