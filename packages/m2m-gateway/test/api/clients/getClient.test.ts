/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockedApiClient } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { unexpectedClientKind } from "../../../src/model/errors.js";
import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";

describe("GET /clients/:clientId route test", () => {
  const mockClient = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });

  const mockM2MClientResponse: m2mGatewayApi.Client =
    toM2MGatewayApiConsumerClient(mockClient);

  const makeRequest = async (token: string, clientId: string = mockClient.id) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.getClient = vi
        .fn()
        .mockResolvedValue(mockM2MClientResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MClientResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for client id", async () => {
    mockClientService.getClient = vi
      .fn()
      .mockResolvedValue(mockM2MClientResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MClientResponse, kind: "INVALID_KIND" },
    { ...mockM2MClientResponse, invalidParam: "invalidValue" },
    { ...mockM2MClientResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockClientService.getClient = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 500 in case of unexpectedClientKind error", async () => {
    mockClientService.getClient = vi
      .fn()
      .mockRejectedValue(unexpectedClientKind(mockClient));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });
});
