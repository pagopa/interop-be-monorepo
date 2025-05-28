/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { attributeKind, generateId } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByName } from "../../src/model/domain/errors.js";

describe("API /verifiedAttributes authorization test", () => {
  const mockVerifiedAttributeSeed: attributeRegistryApi.AttributeSeed = {
    name: "Verified Attribute",
    description: "This is a verified attribute",
  };

  const mockAttribute = getMockAttribute(attributeKind.verified);

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  attributeRegistryService.createVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockAttribute);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/verifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockVerifiedAttributeSeed);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for conflict", async () => {
    attributeRegistryService.createVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDuplicateByName(mockVerifiedAttributeSeed.name)
      );

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid attribute seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .post("/verifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Verified Attribute",
      });
    expect(res.status).toBe(400);
  });
});
