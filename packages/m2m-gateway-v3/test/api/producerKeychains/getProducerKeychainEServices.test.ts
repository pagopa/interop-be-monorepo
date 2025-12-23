import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEservice,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockProducerKeychainService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("GET /producerKeychains/:producerKeychainId/eservices router test", () => {
  const makeRequest = async (
    token: string,
    producerKeychainId: string,
    query: m2mGatewayApiV3.GetProducerKeychainEServicesQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains/${producerKeychainId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const mockApiEService1 = getMockedApiEservice();
  const mockApiEService2 = getMockedApiEservice();

  const mockM2MEServicesResponse: m2mGatewayApiV3.EServices = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiEService(mockApiEService1),
      toM2MGatewayApiEService(mockApiEService2),
    ],
  };

  const mockQueryParams: m2mGatewayApiV3.GetProducerKeychainEServicesQueryParams =
  {
    offset: 0,
    limit: 10,
  };

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const producerKeychainId = generateId();
      mockProducerKeychainService.getProducerKeychainEServices = vi
        .fn()
        .mockResolvedValue(mockM2MEServicesResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, producerKeychainId, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServicesResponse);
      expect(
        mockProducerKeychainService.getProducerKeychainEServices
      ).toHaveBeenCalledWith(
        producerKeychainId,
        mockQueryParams,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), mockQueryParams);
    expect(res.status).toBe(403);
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
      query as m2mGatewayApiV3.GetProducerKeychainEServicesQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockM2MEServicesResponse,
      results: [
        { ...mockM2MEServicesResponse.results[0], isFreeOfCharge: "YES" },
      ],
    },
    {
      ...mockM2MEServicesResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockProducerKeychainService.getProducerKeychainEServices = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockQueryParams);

      expect(res.status).toBe(500);
    }
  );
});
