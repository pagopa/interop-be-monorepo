/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Attribute,
  attributeKind,
  generateId,
  Tenant,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /internal/origin/{tOrigin}/externalId/{tExternalId}/attributes/origin/{aOrigin}/externalId/{aExternalId} test", () => {
  const attribute: Attribute = {
    ...getMockAttribute(),
    origin: "ORIGIN",
    code: "CODE",
    kind: attributeKind.certified,
  };
  const targetTenant: Tenant = {
    ...getMockTenant(),
    attributes: [],
  };

  beforeEach(() => {
    tenantService.internalAssignCertifiedAttribute = vi
      .fn()
      .mockResolvedValue({ version: 1 });
  });

  const makeRequest = async (token: string) =>
    request(api)
      .post(
        `/internal/origin/${targetTenant.externalId.origin}/externalId/${targetTenant.externalId.value}/attributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(res.headers["x-metadata-version"]).toBe("1");
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotFound(targetTenant.id), expectedStatus: 404 },
    { error: attributeNotFound(generateId()), expectedStatus: 404 },
    {
      error: certifiedAttributeAlreadyAssigned(generateId(), generateId()),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.internalAssignCertifiedAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
