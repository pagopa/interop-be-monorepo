/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi, bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiAttribute } from "../../mockUtils.js";
import { toCompactAttribute } from "../../../src/api/attributeApiConverter.js";

describe("API GET /attributes", () => {
  const mockAttribute1: attributeRegistryApi.Attribute = {
    ...getMockApiAttribute(),
    kind: "CERTIFIED",
  };
  const mockAttribute2: attributeRegistryApi.Attribute = {
    ...getMockApiAttribute(),
    kind: "VERIFIED",
  };
  const mockAttribute3: attributeRegistryApi.Attribute = {
    ...getMockApiAttribute(),
    kind: "DECLARED",
  };
  const mockAttributes: attributeRegistryApi.Attributes = {
    results: [mockAttribute1, mockAttribute2, mockAttribute3],
    totalCount: 3,
  };
  const mockResponse: bffApi.Attributes = {
    results: mockAttributes.results.map(toCompactAttribute),
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: mockAttributes.results.length,
    },
  };

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get(`${appBasePath}/attributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit,
        kinds: ["CERTIFIED", "VERIFIED", "DECLARED"],
      });

  beforeEach(() => {
    clients.attributeProcessClient.getAttributes = vi
      .fn()
      .mockResolvedValue(mockAttributes);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResponse);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
