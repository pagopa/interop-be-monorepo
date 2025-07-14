/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPublicKey } from "../../mockUtils.js";

describe("API GET /clients/:clientId/keys", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
  };
  const mockApiPublicKeys: bffApi.PublicKeys = {
    keys: [
      getMockBffApiPublicKey(),
      getMockBffApiPublicKey(),
      getMockBffApiPublicKey(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 3,
    },
  };

  beforeEach(() => {
    services.clientService.getClientKeys = vi
      .fn()
      .mockResolvedValue(mockApiPublicKeys);
  });

  const makeRequest = async (
    token: string,
    clientId: ClientId = generateId(),
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/clients/${clientId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiPublicKeys);
  });

  it.each([
    { clientId: "invalid" as ClientId },
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 5 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
    { query: { ...defaultQuery, userIds: "invalid" } },
    { query: { ...defaultQuery, userIds: ["invalid"] } },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ clientId, query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        clientId,
        query as typeof defaultQuery
      );
      expect(res.status).toBe(400);
    }
  );
});
