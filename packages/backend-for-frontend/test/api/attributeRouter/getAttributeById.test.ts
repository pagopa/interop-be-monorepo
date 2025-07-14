/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttributeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockAttributeRegistryApiAttribute } from "../../mockUtils.js";

describe("API GET /attributes/:attributeId", () => {
  const mockAttributeRegistryApiAttribute =
    getMockAttributeRegistryApiAttribute();
  const mockApiAttribute = bffApi.Attribute.parse(
    mockAttributeRegistryApiAttribute
  );

  beforeEach(() => {
    clients.attributeProcessClient.getAttributeById = vi
      .fn()
      .mockResolvedValue(mockAttributeRegistryApiAttribute);
  });

  const makeRequest = async (
    token: string,
    attributeId: AttributeId = mockApiAttribute.id as AttributeId
  ) =>
    request(api)
      .get(`${appBasePath}/attributes/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAttribute);
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as AttributeId);
    expect(res.status).toBe(400);
  });
});
