import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiCompactClient,
  getMockedApiFullClient,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { unexpectedClientKind } from "../../../src/model/errors.js";
import { toM2MGatewayApiClient } from "../../../src/api/clientApiConverter.js";

describe("GET /clients router test", () => {
  const m2mCompactClientsResponse: m2mGatewayApi.Clients = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiClient(
        getMockedApiCompactClient({
          kind: authorizationApi.ClientKind.Values.CONSUMER,
        })
      ),
      toM2MGatewayApiClient(
        getMockedApiCompactClient({
          kind: authorizationApi.ClientKind.Values.CONSUMER,
        })
      ),
    ],
  };

  const m2mFullClientsResponse: m2mGatewayApi.Clients = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiClient(
        getMockedApiFullClient({
          kind: authorizationApi.ClientKind.Values.CONSUMER,
        })
      ),
      toM2MGatewayApiClient(
        getMockedApiFullClient({
          kind: authorizationApi.ClientKind.Values.CONSUMER,
        })
      ),
    ],
  };

  const mockQueryParams: m2mGatewayApi.GetClientsQueryParams = {
    consumerId: generateId(),
    userIds: [generateId()],
    name: generateMock(z.string()),
    purposeId: generateId(),
    offset: 0,
    limit: 10,
  };

  const makeRequest = async (
    token: string,
    query: m2mGatewayApi.GetClientsQueryParams
  ) =>
    request(api)
      .get(`${appBasePath}/clients`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 with full clients and perform service calls for user with role %s",
    async (role) => {
      mockClientService.getClients = vi
        .fn()
        .mockResolvedValue(m2mFullClientsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mFullClientsResponse);
      expect(mockClientService.getClients).toHaveBeenCalledWith(
        mockQueryParams,
        expect.any(Object)
      );
    }
  );

  it.each(authorizedRoles)(
    "Should return 200 with compact clients and perform service calls for user with role %s",
    async (role) => {
      mockClientService.getClients = vi
        .fn()
        .mockResolvedValue(m2mCompactClientsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mCompactClientsResponse);
      expect(mockClientService.getClients).toHaveBeenCalledWith(
        mockQueryParams,
        expect.any(Object)
      );
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
    { ...mockQueryParams, consumerId: "invalidConsumerId" },
    { ...mockQueryParams, userIds: ["invalidUserId"] },
    { ...mockQueryParams, purposeId: "invalidPurposeId" },
    { ...mockQueryParams, offset: -2 },
    { ...mockQueryParams, limit: 100 },
    { ...mockQueryParams, offset: "invalidOffset" },
    { ...mockQueryParams, limit: "invalidLimit" },
  ])("Should return 400 if passed invalid query params", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as m2mGatewayApi.GetClientsQueryParams
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...m2mCompactClientsResponse,
      results: [
        { ...m2mCompactClientsResponse.results[0], kind: "invalidKind" },
      ],
    },
    {
      ...m2mCompactClientsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
    {
      ...m2mFullClientsResponse,
      results: [{ ...m2mFullClientsResponse.results[0], kind: "invalidKind" }],
    },
    {
      ...m2mFullClientsResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockClientService.getClients = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 500 in case of unexpectedClientKind error", async () => {
    mockClientService.getClients = vi
      .fn()
      .mockRejectedValue(unexpectedClientKind(getMockedApiCompactClient()));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
