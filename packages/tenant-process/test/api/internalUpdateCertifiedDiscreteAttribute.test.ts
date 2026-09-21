/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { generateId, Tenant } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  attributeNotFound,
  attributeNotFoundInTenant,
  tenantNotFound,
  tenantNotFoundByRemoteId,
} from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API PUT /internal/origin/{tOrigin}/remoteId/{tRemoteId}/certifiedDiscreteAttributes/origin/{aOrigin}/externalId/{aExternalId} test", () => {
  const tRemoteId = "015146";
  const attribute = { origin: "ISTAT", code: "001" };
  const targetTenant: Tenant = {
    ...getMockTenant(),
    attributes: [],
  };

  beforeEach(() => {
    tenantService.internalUpdateCertifiedDiscreteAttribute = vi
      .fn()
      .mockResolvedValue({ version: 1 });
  });

  const makeRequest = async (token: string, value = 100) =>
    request(api)
      .put(
        `/internal/origin/${targetTenant.externalId.origin}/remoteId/${tRemoteId}/certifiedDiscreteAttributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ value });

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
      error: attributeNotFoundInTenant(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: tenantNotFoundByRemoteId("ISTAT", generateId()),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.internalUpdateCertifiedDiscreteAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
