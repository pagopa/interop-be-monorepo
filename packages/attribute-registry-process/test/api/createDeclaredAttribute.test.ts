/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import jwt from "jsonwebtoken";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByName } from "../../src/model/domain/errors.js";

describe("API /declaredAttributes authorization test", () => {
  const mockDeclaredAttributeSeed: attributeRegistryApi.AttributeSeed = {
    name: "Declared Attribute",
    description: "This is a declared attribute",
  };

  const mockAttribute: Attribute = {
    ...getMockAttribute(),
    id: generateId(),
    kind: "Declared",
    creationTime: new Date(),
  };

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  vi.spyOn(
    attributeRegistryService,
    "createDeclaredAttribute"
  ).mockResolvedValue(mockAttribute);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string) =>
    request(api)
      .post("/declaredAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockDeclaredAttributeSeed);

  it.each([userRoles.ADMIN_ROLE, userRoles.M2M_ROLE, userRoles.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
    }
  );

  it.each(
    Object.values(userRoles).filter(
      (role) =>
        role !== userRoles.ADMIN_ROLE &&
        role !== userRoles.M2M_ROLE &&
        role !== userRoles.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken({ ...getMockAuthData(), userRoles: [role] });
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for conflict", async () => {
    vi.spyOn(
      attributeRegistryService,
      "createDeclaredAttribute"
    ).mockRejectedValue(
      attributeDuplicateByName(mockDeclaredAttributeSeed.name)
    );

    const res = await makeRequest(generateToken(getMockAuthData()));

    expect(res.status).toBe(409);
  });
});
