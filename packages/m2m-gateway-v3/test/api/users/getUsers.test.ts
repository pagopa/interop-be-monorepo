import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockUserService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("GET /users router test", () => {
  const mockUsersResponse: m2mGatewayApiV3.Users = {
    pagination: { offset: 0, limit: 10, totalCount: 2 },
    results: [
      {
        userId: generateId(),
        name: "John",
        familyName: "Doe",
        roles: ["admin", "operator"],
      },
      {
        userId: generateId(),
        name: "Jane",
        familyName: "Smith",
        roles: ["operator"],
      },
    ],
  };

  const mockQueryParams = {
    roles: ["admin", "operator"],
    limit: 10,
    offset: 0,
  };

  const makeRequest = async (
    token: string,
    query: {
      roles?: string[];
      limit: number;
      offset: number;
    }
  ) =>
    request(api)
      .get(`${appBasePath}/users`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .query(query)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockUserService.getUsers = vi.fn().mockResolvedValue(mockUsersResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsersResponse);
      expect(mockUserService.getUsers).toHaveBeenCalledWith(
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
    { offset: 0 }, // missing limit
    { limit: 10 }, // missing offset
    { ...mockQueryParams, offset: -1 }, // invalid offset
    { ...mockQueryParams, limit: 0 }, // invalid limit (minimum is 1)
    { ...mockQueryParams, limit: 101 }, // invalid limit (maximum is 100)
    { ...mockQueryParams, offset: "invalidOffset" }, // invalid offset type
    { ...mockQueryParams, limit: "invalidLimit" }, // invalid limit type
  ])("Should return 400 if passed invalid query params: %o", async (query) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      query as unknown as {
        roles?: string[];
        limit: number;
        offset: number;
      }
    );

    expect(res.status).toBe(400);
  });

  it.each([
    {
      ...mockUsersResponse,
      results: [{ ...mockUsersResponse.results[0], userId: "invalid-uuid" }],
    },
    {
      ...mockUsersResponse,
      results: [{ ...mockUsersResponse.results[0], name: 123 }],
    },
    {
      ...mockUsersResponse,
      results: [{ userId: generateId(), name: "John" }], // missing familyName and roles
    },
    {
      ...mockUsersResponse,
      pagination: {
        offset: "invalidOffset",
        limit: "invalidLimit",
        totalCount: 0,
      },
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockUserService.getUsers = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockQueryParams);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 500 in case of generic error", async () => {
    mockUserService.getUsers = vi
      .fn()
      .mockRejectedValue(new Error("Generic error"));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockQueryParams);

    expect(res.status).toBe(500);
  });
});
