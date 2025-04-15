/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
  getSystemOrUserAuthData,
} from "pagopa-interop-commons-test";
import { AuthData, systemRole, userRole } from "pagopa-interop-commons";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { attributeNotFound } from "../../src/model/domain/errors.js";

describe("API /attributes/origin/{origin}/code/{code} authorization test", () => {
  const attribute: Attribute = {
    ...getMockAttribute(),
    origin: "IPA",
    code: "001",
  };

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(attribute)
  );

  vi.spyOn(
    attributeRegistryService,
    "getAttributeByOriginAndCode"
  ).mockResolvedValue({
    data: attribute,
    metadata: { version: 1 },
  });
  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, origin: string, code: string) =>
    request(api)
      .get(`/attributes/origin/${origin}/code/${code}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it.each([
    userRole.ADMIN_ROLE,
    systemRole.INTERNAL_ROLE,
    systemRole.M2M_ROLE,
    userRole.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token, attribute.origin!, attribute.code!);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAttribute);
  });

  it.each([
    userRole.API_ROLE,
    userRole.SECURITY_ROLE,
    systemRole.MAINTENANCE_ROLE,
  ])("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token, attribute.origin!, attribute.code!);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for attributeNotFound", async () => {
    vi.spyOn(
      attributeRegistryService,
      "getAttributeByOriginAndCode"
    ).mockRejectedValue(attributeNotFound(attribute.id));

    const res = await makeRequest(generateToken(getMockAuthData()), "", "");

    expect(res.status).toBe(404);
  });
});
