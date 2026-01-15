/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("GET /agreements route test", () => {
  const mockResponse: m2mGatewayApiV3.Agreements = {
    results: [toM2MGatewayApiAgreement(getMockedApiAgreement(), generateId())],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 1,
    },
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApiV3.GetAgreementsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/agreements`)
      .query(query)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const mockQueryParams: m2mGatewayApiV3.GetAgreementsQueryParams = {
    consumerIds: [generateId(), generateId()],
    eserviceIds: [generateId(), generateId()],
    producerIds: [generateId(), generateId()],
    descriptorIds: [generateId(), generateId()],
    states: [
      m2mGatewayApiV3.AgreementState.Values.ACTIVE,
      m2mGatewayApiV3.AgreementState.Values.SUSPENDED,
    ],
    offset: 0,
    limit: 10,
  };

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.getAgreements = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
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
    { ...mockQueryParams, consumerIds: ["INVALID_ID"] },
    { ...mockQueryParams, eserviceIds: ["INVALID_ID"] },
    { ...mockQueryParams, producerIds: ["INVALID_ID"] },
    { ...mockQueryParams, descriptorIds: ["INVALID_ID"] },
    { ...mockQueryParams, states: ["INVALID_STATE"] },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as m2mGatewayApiV3.GetAgreementsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockResponse,
      results: [{ ...mockResponse.results[0], state: "INVALID_STATE" }],
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
      mockAgreementService.getAgreements = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
