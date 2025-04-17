/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Attribute, generateId, ListResult } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";

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

  attributeRegistryService.getAttributesByIds = vi
    .fn()
    .mockResolvedValue(attributes);

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
      const res = await makeRequest(token, [attribute1.id, attribute2.id]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttributes);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, [attribute1.id]);
    expect(res.status).toBe(403);
  });
});
