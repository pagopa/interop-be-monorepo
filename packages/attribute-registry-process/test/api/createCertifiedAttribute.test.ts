/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { attributeKind, generateId } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByCodeOriginOrName } from "../../src/model/domain/errors.js";

describe("API /certifiedAttributes authorization test", () => {
  const mockCertifiedAttributeSeed: attributeRegistryApi.CertifiedAttributeSeed =
    {
      name: "Certified Attribute",
      description: "This is a certified attribute",
      code: "001",
    };
  const mockAttribute = getMockAttribute(attributeKind.certified);

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  attributeRegistryService.createCertifiedAttribute = vi
    .fn()
    .mockResolvedValue({ data: mockAttribute, metadata: { version: 0 } });

  const makeRequest = async (token: string) =>
    request(api)
      .post("/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockCertifiedAttributeSeed);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
      expect(res.headers["x-metadata-version"]).toBe("0");
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
    attributeRegistryService.createCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDuplicateByCodeOriginOrName(
          mockCertifiedAttributeSeed.name,
          mockCertifiedAttributeSeed.code,
          "origin"
        )
      );
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid certified attribute seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .post("/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Certified Attribute",
        code: "001",
      });
    expect(res.status).toBe(400);
  });
});
