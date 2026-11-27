/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { attributeKind, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByCodeOriginOrName } from "../../src/model/domain/errors.js";
import { api, attributeRegistryService } from "../vitest.api.setup.js";

describe("API /internal/certifiedAttributes authorization test", () => {
  const mockInternalCertifiedAttributeSeed: attributeRegistryApi.InternalCertifiedAttributeSeed =
    {
      code: "001",
      name: "Internal certified attribute",
      description: "description",
      origin: "IPA",
    };

  const mockAttribute = getMockAttribute(attributeKind.certified);

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  attributeRegistryService.internalCreateCertifiedAttribute = vi
    .fn()
    .mockResolvedValue(mockAttribute);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/internal/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockInternalCertifiedAttributeSeed);

  it("Should return 201 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(apiAttribute);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for conflict", async () => {
    attributeRegistryService.internalCreateCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDuplicateByCodeOriginOrName(
          mockInternalCertifiedAttributeSeed.name,
          mockInternalCertifiedAttributeSeed.code,
          mockInternalCertifiedAttributeSeed.origin
        )
      );

    const res = await makeRequest(generateToken(authRole.INTERNAL_ROLE));

    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid attribute seed", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await request(api)
      .post("/internal/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        code: "001",
        name: "Internal certified attribute",
        origin: "IPA",
      });
    expect(res.status).toBe(400);
  });
});
