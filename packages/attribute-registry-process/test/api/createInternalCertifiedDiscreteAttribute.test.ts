/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { attributeKind, generateId } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { api, attributeRegistryService } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByCodeOriginOrName } from "../../src/model/domain/errors.js";

describe("API /internal/certifiedDiscreteAttributes authorization test", () => {
  const mockInternalCertifiedDiscreteAttributeSeed: attributeRegistryApi.InternalCertifiedDiscreteAttributeSeed =
    {
      code: "001",
      name: "Internal certified discrete attribute",
      description: "description",
      origin: "IPA",
    };

  const mockAttribute = getMockAttribute(attributeKind.certifiedDiscrete);

  const apiAttribute = attributeRegistryApi.Attribute.parse(
    toApiAttribute(mockAttribute)
  );

  attributeRegistryService.internalCreateCertifiedDiscreteAttribute = vi
    .fn()
    .mockResolvedValue(mockAttribute);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/internal/certifiedDiscreteAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockInternalCertifiedDiscreteAttributeSeed);

  it("Should return 200 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);
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
    attributeRegistryService.internalCreateCertifiedDiscreteAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeDuplicateByCodeOriginOrName(
          mockInternalCertifiedDiscreteAttributeSeed.name,
          mockInternalCertifiedDiscreteAttributeSeed.code,
          mockInternalCertifiedDiscreteAttributeSeed.origin
        )
      );

    const res = await makeRequest(generateToken(authRole.INTERNAL_ROLE));

    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid attribute seed", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await request(api)
      .post("/internal/certifiedDiscreteAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({
        code: "001",
        name: "Internal certified discrete attribute",
        origin: "IPA",
      });
    expect(res.status).toBe(400);
  });
});
