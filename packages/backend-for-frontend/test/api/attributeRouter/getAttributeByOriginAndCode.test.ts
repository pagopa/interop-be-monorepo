/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockAttributeRegistryApiAttribute } from "../../mockUtils.js";

describe("API GET /attributes/origin/:origin/code/:code", () => {
  const mockOrigin = "IPA";
  const mockCode = "code";
  const mockAttributeRegistryApiAttribute =
    getMockAttributeRegistryApiAttribute();
  const mockApiAttribute = bffApi.Attribute.parse(
    mockAttributeRegistryApiAttribute
  );

  const makeRequest = async (token: string, code: unknown = mockCode) =>
    request(api)
      .get(`${appBasePath}/attributes/origin/${mockOrigin}/code/${code}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    clients.attributeProcessClient.getAttributeByOriginAndCode = vi
      .fn()
      .mockResolvedValue(mockAttributeRegistryApiAttribute);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAttribute);
  });

  // Problem: there seem to be no way of passing invalid parameters?
  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, null);
    expect(res.status).toBe(400);
  });
});
