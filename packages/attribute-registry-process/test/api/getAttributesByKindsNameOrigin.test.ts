/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Attribute, generateId, ListResult } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";

describe("API /attributes authorization test", () => {
  const attribute1: Attribute = {
    ...getMockAttribute(),
    kind: "Declared",
    name: "attribute1",
    origin: "IPA",
  };
  const attribute2: Attribute = {
    ...getMockAttribute(),
    kind: "Certified",
    name: "attribute2",
    origin: "SPC",
  };

  const attributes: ListResult<Attribute> = {
    results: [attribute1, attribute2],
    totalCount: 2,
  };

  const apiAttributes = attributeRegistryApi.Attributes.parse({
    results: attributes.results.map(toApiAttribute),
    totalCount: attributes.totalCount,
  });

  attributeRegistryService.getAttributesByKindsNameOrigin = vi
    .fn()
    .mockResolvedValue(attributes);

  const makeRequest = async (
    token: string,
    kinds: attributeRegistryApi.AttributeKind[]
  ) =>
    request(api)
      .get(`/attributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit: 5,
        kinds: kinds.join(","),
      });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, ["DECLARED", "CERTIFIED"]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttributes);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, ["DECLARED", "CERTIFIED"]);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid kind", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .get(`/attributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({
        offset: 0,
        limit: 5,
        kinds: ["DECLARED", "invalid"].join(","),
      });
    expect(res.status).toBe(400);
  });
});
