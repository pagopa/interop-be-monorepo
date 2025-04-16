/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { Attribute, generateId } from "pagopa-interop-models";
import { generateToken, getMockAttribute } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { attributeRegistryService } from "../../src/routers/AttributeRouter.js";
import { api } from "../vitest.api.setup.js";
import { toApiAttribute } from "../../src/model/domain/apiConverter.js";
import { attributeDuplicateByNameAndCode } from "../../src/model/domain/errors.js";

describe("API /certifiedAttributes authorization test", () => {
  const mockCertifiedAttributeSeed: attributeRegistryApi.CertifiedAttributeSeed =
    {
      name: "Certified Attribute",
      description: "This is a certified attribute",
      code: "001",
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
    "createCertifiedAttribute"
  ).mockResolvedValue(mockAttribute);

  const makeRequest = async (token: string) =>
    request(api)
      .post("/certifiedAttributes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockCertifiedAttributeSeed);

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.M2M_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiAttribute);
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
    vi.spyOn(
      attributeRegistryService,
      "createCertifiedAttribute"
    ).mockRejectedValue(
      attributeDuplicateByNameAndCode(
        mockCertifiedAttributeSeed.name,
        mockCertifiedAttributeSeed.code
      )
    );

    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

    expect(res.status).toBe(409);
  });
});
