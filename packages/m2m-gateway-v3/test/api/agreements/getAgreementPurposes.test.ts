import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("GET /agreement/:agreementId/purposes router test", () => {
  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  const makeRequest = async (
    token: string,
    agreementId: string,
    query: m2mGatewayApiV3.GetAgreementPurposesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/${agreementId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiPurpose1 = getMockedApiPurpose();
  const mockApiPurpose2 = getMockedApiPurpose();

  const mockM2MPurposesResponse: m2mGatewayApiV3.Purposes = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiPurpose(mockApiPurpose1),
      toM2MGatewayApiPurpose(mockApiPurpose2),
    ],
  };

  const mockQueryParams: m2mGatewayApiV3.GetAgreementPurposesQueryParams = {
    offset: 0,
    limit: 10,
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.getAgreementPurposes = vi
        .fn()
        .mockResolvedValue(mockM2MPurposesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposesResponse);
    }
  );

  it("Should return 400 for incorrect value for agreement id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID", mockQueryParams);
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      query as m2mGatewayApiV3.GetAgreementPurposesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockQueryParams);
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
      mockAgreementService.getAgreementPurposes = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
