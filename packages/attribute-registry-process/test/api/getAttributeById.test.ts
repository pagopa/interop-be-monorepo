/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Attribute, generateId } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeNotFound } from "../../src/model/domain/errors.js";

describe("API /attributes/{attributeId} authorization test", () => {
  const attribute: Attribute = getMockAttribute();

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(attribute)
  );

  attributeRegistryService.getAttributeById = vi.fn().mockResolvedValue({
    data: attribute,
    metadata: { version: 1 },
  });

  const makeRequest = async (token: string, attributeId: string) =>
    request(api)
      .get(`/attributes/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, attribute.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, attribute.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for attributeNotFound", async () => {
    attributeRegistryService.getAttributeById = vi
      .fn()
      .mockRejectedValue(attributeNotFound(attribute.id));

    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      generateId()
    );

    expect(res.status).toBe(404);
  });
});
