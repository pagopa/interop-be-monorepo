/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import {
  attributeDuplicateByName,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

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

  const serviceResponse = getMockWithMetadata(mockAttribute);

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  attributeRegistryService.createDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/declaredAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockDeclaredAttributeSeed);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
    attributeRegistryService.createDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDuplicateByName(mockDeclaredAttributeSeed.name)
      );

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid attribute seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .post("/declaredAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        name: "Declared Attribute",
      });
    expect(res.status).toBe(400);
  });

  it("Should return 500 for tenant not found", async () => {
    attributeRegistryService.createDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));

    const res = await makeRequest(generateToken(authRole.M2M_ADMIN_ROLE));

    expect(res.status).toBe(500);
  });
});
