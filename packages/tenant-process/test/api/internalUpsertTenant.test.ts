/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";

describe("API POST /internal/tenants test", () => {
  const tenantSeed: tenantApi.InternalTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
  };
  const tenant: Tenant = getMockTenant();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.internalUpsertTenant = vi.fn().mockResolvedValue({
      data: tenant,
      metadata: { version: 1 },
    });
  });

  const makeRequest = async (
    token: string,
    body: tenantApi.InternalTenantSeed = tenantSeed
  ) =>
    request(api)
      .post("/internal/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
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
    { error: tenantNotFound(tenant.id), expectedStatus: 404 },
    { error: attributeNotFound(generateId()), expectedStatus: 404 },
    {
      error: certifiedAttributeAlreadyAssigned(generateId(), generateId()),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.internalUpsertTenant = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...tenantSeed, externalId: { origin: "IPA" } } },
    { body: { ...tenantSeed, externalId: { origin: 1, value: "123456" } } },
    { body: { ...tenantSeed, certifiedAttributes: [{}] } },
    { body: { ...tenantSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, body as tenantApi.InternalTenantSeed);
    expect(res.status).toBe(400);
  });
});
