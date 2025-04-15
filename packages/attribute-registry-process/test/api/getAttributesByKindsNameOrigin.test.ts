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

  vi.spyOn(
    attributeRegistryService,
    "getAttributesByKindsNameOrigin"
  ).mockResolvedValue(attributes);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

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

  it.each([
    userRole.ADMIN_ROLE,
    userRole.API_ROLE,
    userRole.SECURITY_ROLE,
    systemRole.M2M_ROLE,
    userRole.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token, ["DECLARED", "CERTIFIED"]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAttributes);
  });

  it.each([systemRole.INTERNAL_ROLE, systemRole.MAINTENANCE_ROLE])(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken(getSystemOrUserAuthData(role));
      const res = await makeRequest(token, ["DECLARED", "CERTIFIED"]);

      expect(res.status).toBe(403);
    }
  );
});
