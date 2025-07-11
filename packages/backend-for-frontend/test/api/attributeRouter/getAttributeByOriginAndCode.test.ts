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

  beforeEach(() => {
    clients.attributeProcessClient.getAttributeByOriginAndCode = vi
      .fn()
      .mockResolvedValue(mockAttributeRegistryApiAttribute);
  });

  const makeRequest = async (
    token: string,
    origin: string = mockOrigin,
    code: string = mockCode
  ) =>
    request(api)
      .get(`${appBasePath}/attributes/origin/${origin}/code/${code}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAttribute);
  });
});
