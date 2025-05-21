/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiCompactClient } from "../../mockUtils.js";

describe("API GET /clients", () => {
  const mockApiClient1 = getMockApiCompactClient();
  const mockApiClient2 = getMockApiCompactClient();
  const mockApiClient3 = getMockApiCompactClient();
  const mockApiClients: bffApi.CompactClients = {
    results: [mockApiClient1, mockApiClient2, mockApiClient3],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/clients`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit,
      });

  beforeEach(() => {
    services.clientService.getClients = vi
      .fn()
      .mockResolvedValue(mockApiClients);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiClients);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
