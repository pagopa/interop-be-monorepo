/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
  getSystemOrUserAuthData,
} from "pagopa-interop-commons-test";
import { Allrole, AuthData, userRole } from "pagopa-interop-commons";
import jwt from "jsonwebtoken";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByName } from "../../src/model/domain/errors.js";

describe("API /verifiedAttributes authorization test", () => {
  const mockVerifiedAttributeSeed: attributeRegistryApi.AttributeSeed = {
    name: "Verified Attribute",
    description: "This is a verified attribute",
  };

  const mockAttribute: Attribute = {
    ...getMockAttribute(),
    id: generateId(),
    kind: "Verified",
    creationTime: new Date(),
  };

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  vi.spyOn(
    attributeRegistryService,
    "createVerifiedAttribute"
  ).mockResolvedValue(mockAttribute);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string) =>
    request(api)
      .post("/verifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockVerifiedAttributeSeed);

  it.each([userRole.ADMIN_ROLE, userRole.API_ROLE])(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(getSystemOrUserAuthData(role));
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
    }
  );

  it.each(
    Object.values(Allrole).filter(
      (role) => role !== userRole.ADMIN_ROLE && role !== userRole.API_ROLE
    )
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for conflict", async () => {
    vi.spyOn(
      attributeRegistryService,
      "createVerifiedAttribute"
    ).mockRejectedValue(
      attributeDuplicateByName(mockVerifiedAttributeSeed.name)
    );

    const res = await makeRequest(generateToken(getMockAuthData()));

    expect(res.status).toBe(409);
  });
});
