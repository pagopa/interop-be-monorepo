/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Tenant, generateId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantIsNotACertifier,
  tenantNotFound,
  tenantNotFoundByExternalId,
} from "../../src/model/domain/errors.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";

describe("API POST /m2m/tenants test", () => {
  const tenant: Tenant = getMockTenant();
  const tenantSeed: tenantApi.M2MTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ code: "CODE" }],
  };

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.m2mUpsertTenant = vi.fn().mockResolvedValue(tenant);
  });

  const makeRequest = async (
    token: string,
    body: tenantApi.M2MTenantSeed = tenantSeed
  ) =>
    request(api)
      .post("/m2m/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role M2M", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(Object.values(authRole).filter((role) => role !== authRole.M2M_ROLE))(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(403);
    }
  );

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: attributeNotFound(generateId()), expectedStatus: 404 },
    {
      error: tenantNotFoundByExternalId(
        tenantSeed.externalId.origin,
        tenantSeed.externalId.value
      ),
      expectedStatus: 404,
    },
    {
      error: certifiedAttributeAlreadyAssigned(generateId(), generateId()),
      expectedStatus: 409,
    },
    { error: tenantIsNotACertifier(generateId()), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.m2mUpsertTenant = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { ...tenantSeed, externalId: { origin: "IPA" } } },
    { body: { ...tenantSeed, externalId: { origin: 1, value: "123456" } } },
    { body: { ...tenantSeed, certifiedAttributes: [{}] } },
    { body: { ...tenantSeed, name: 1 } },
    { body: { ...tenantSeed, name: "" } },
    { body: { ...tenantSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, body as tenantApi.M2MTenantSeed);
    expect(res.status).toBe(400);
  });
});
