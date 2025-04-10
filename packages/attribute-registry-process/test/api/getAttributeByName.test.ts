/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { attributeNotFound } from "../../src/model/domain/errors.js";

describe("API /attributes/name/{name} authorization test", () => {
  const attribute: Attribute = getMockAttribute();

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(attribute)
  );

  vi.spyOn(attributeRegistryService, "getAttributeByName").mockResolvedValue({
    data: attribute,
    metadata: { version: 1 },
  });
  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, name: string) =>
    request(api)
      .get(`/attributes/name/${name}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it.each([
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [role],
    });
    const res = await makeRequest(token, attribute.name);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAttribute);
  });

  it.each([userRoles.INTERNAL_ROLE, userRoles.MAINTENANCE_ROLE])(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });
      const res = await makeRequest(token, attribute.name);

      expect(res.status).toBe(403);
    }
  );

  it("Should return 404 for attributeNotFound", async () => {
    vi.spyOn(attributeRegistryService, "getAttributeByName").mockRejectedValue(
      attributeNotFound(attribute.id)
    );

    const res = await makeRequest(
      generateToken(getMockAuthData()),
      generateId()
    );

    expect(res.status).toBe(404);
  });
});
