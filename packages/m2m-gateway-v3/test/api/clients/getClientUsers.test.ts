/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { userNotFound } from "../../../src/model/errors.js";
import { getMockm2mGatewayApiV3User } from "../../mockUtils.js";

describe("API GET /clients/:clientId/users", () => {
  const mockResponse: m2mGatewayApiV3.Users = {
    results: [
      getMockm2mGatewayApiV3User(),
      getMockm2mGatewayApiV3User(),
      getMockm2mGatewayApiV3User(),
    ],
    pagination: {
      limit: 10,
      offset: 0,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    mockClientService.getClientUsers = vi.fn().mockResolvedValue(mockResponse);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId,
    query: {
      limit: number;
      offset: number;
    }
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/users`)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), {
        limit: 10,
        offset: 0,
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it("Should return 404 for userNotFound", async () => {
    mockClientService.getClientUsers = vi
      .fn()
      .mockRejectedValue(userNotFound(generateId(), generateId()));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), {
      limit: 10,
      offset: 0,
    });
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as ClientId, {
      limit: 10,
      offset: 0,
    });
    expect(res.status).toBe(400);
  });
});
