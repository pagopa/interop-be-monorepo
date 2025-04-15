/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Attribute, generateId } from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getSystemOrUserAuthData,
} from "pagopa-interop-commons-test";
import { Allrole, AuthData, systemRole } from "pagopa-interop-commons";
import jwt from "jsonwebtoken";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByNameAndCode } from "../../src/model/domain/errors.js";

describe("API /internal/certifiedAttributes authorization test", () => {
  const mockInternalCertifiedAttributeSeed: attributeRegistryApi.InternalCertifiedAttributeSeed =
    {
      code: "001",
      name: "Internal certified attribute",
      description: "description",
      origin: "IPA",
    };

  const mockAttribute: Attribute = {
    ...getMockAttribute(),
    id: generateId(),
    kind: "Certified",
    creationTime: new Date(),
  };

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  vi.spyOn(
    attributeRegistryService,
    "internalCreateCertifiedAttribute"
  ).mockResolvedValue(mockAttribute);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string) =>
    request(api)
      .post("/internal/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockInternalCertifiedAttributeSeed);

  it("Should return 200 for user with role Internal", async () => {
    const token = generateToken(
      getSystemOrUserAuthData(systemRole.INTERNAL_ROLE)
    );
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiAttribute);
  });

  it.each(
    Object.values(Allrole).filter((role) => role !== systemRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(getSystemOrUserAuthData(role));
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for conflict", async () => {
    vi.spyOn(
      attributeRegistryService,
      "internalCreateCertifiedAttribute"
    ).mockRejectedValue(
      attributeDuplicateByNameAndCode(
        mockInternalCertifiedAttributeSeed.name,
        mockInternalCertifiedAttributeSeed.code
      )
    );

    const res = await makeRequest(
      generateToken(getSystemOrUserAuthData(systemRole.INTERNAL_ROLE))
    );

    expect(res.status).toBe(409);
  });
});
