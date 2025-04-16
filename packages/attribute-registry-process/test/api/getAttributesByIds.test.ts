/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Attribute, generateId, ListResult } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getSystemOrUserAuthData,
} from "pagopa-interop-commons-test";
import { AuthData, systemRole, userRole } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";

describe("API /bulk/attributes authorization test", () => {
  const attribute1: Attribute = getMockAttribute();
  const attribute2: Attribute = getMockAttribute();

  const attributes: ListResult<Attribute> = {
    results: [attribute1, attribute2],
    totalCount: 2,
  };

  const apiAttributes = attributeRegistryApi.Attributes.parse({
    results: attributes.results.map(toApiAttribute),
    totalCount: attributes.totalCount,
  });

  vi.spyOn(attributeRegistryService, "getAttributesByIds").mockResolvedValue(
    attributes
  );

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, ids: string[]) =>
    request(api)
      .post(`/bulk/attributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit: 5,
      })
      .send(ids);

  it.each([
    userRole.ADMIN_ROLE,
    userRole.API_ROLE,
    userRole.SECURITY_ROLE,
    systemRole.M2M_ROLE,
    userRole.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token, [attribute1.id, attribute2.id]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAttributes);
  });

  it.each([
    systemRole.INTERNAL_ROLE,
    systemRole.MAINTENANCE_ROLE,
    systemRole.M2M_ADMIN_ROLE,
  ])("Should return 500 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token, [attribute1.id]);
    // This is because the route catches any type of error and returns a 500
    expect(res.status).toBe(500);
  });
});
