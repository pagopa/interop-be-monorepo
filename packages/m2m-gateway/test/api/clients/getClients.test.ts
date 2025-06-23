import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockedApiClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { unexpectedClientKind } from "../../../src/model/errors.js";
import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";

describe("GET /clients router test", () => {
  const mockApiClient1 = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockApiClient2 = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const m2mClientsResponse: m2mGatewayApi.Clients = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      toM2MGatewayApiConsumerClient(mockApiClient1),
      toM2MGatewayApiConsumerClient(mockApiClient2),
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
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.getClients = vi
        .fn()
        .mockResolvedValue(m2mClientsResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mClientsResponse);
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
      ...m2mClientsResponse,
      results: [{ ...m2mClientsResponse.results[0], kind: "invalidKind" }],
    },
    {
      ...m2mClientsResponse,
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
      .mockRejectedValue(unexpectedClientKind(mockApiClient1));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
