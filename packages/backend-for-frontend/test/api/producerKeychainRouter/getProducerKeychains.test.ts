/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCompactProducerKeychain } from "../../mockUtils.js";

describe("API GET /producerKeychains test", () => {
  const defaultQuery = {
    offset: 0,
    limit: 5,
    q: "",
    userIds: `${generateId()},${generateId()}`,
    eserviceId: generateId(),
  };

  const mockCompactProducerKeychains: bffApi.CompactProducerKeychains = {
    results: [
      getMockBffApiCompactProducerKeychain(),
      getMockBffApiCompactProducerKeychain(),
    ],
    pagination: {
      offset: defaultQuery.offset,
      limit: defaultQuery.limit,
      totalCount: 2,
    },
  };

  beforeEach(() => {
    services.producerKeychainService.getProducerKeychains = vi
      .fn()
      .mockResolvedValue(mockCompactProducerKeychains);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCompactProducerKeychains);
  });

  it.each([
    { query: {} },
    { query: { ...defaultQuery, offset: undefined } },
    { query: { ...defaultQuery, limit: undefined } },
    { query: { ...defaultQuery, offset: -1 } },
    { query: { ...defaultQuery, limit: -2 } },
    { query: { ...defaultQuery, limit: 55 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
    { query: { ...defaultQuery, userIds: `${generateId()},invalid` } },
    { query: { ...defaultQuery, eserviceId: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof defaultQuery);
    expect(res.status).toBe(400);
  });
});
