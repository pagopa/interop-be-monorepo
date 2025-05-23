/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";

describe("API POST /tenants/delegatedFeatures/update test", () => {
  const tenantFeatures: tenantApi.TenantDelegatedFeaturesFlagsUpdateSeed = {
    isDelegatedConsumerFeatureEnabled: true,
    isDelegatedProducerFeatureEnabled: false,
  };

  beforeEach(() => {
    tenantService.updateTenantDelegatedFeatures = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: tenantApi.TenantDelegatedFeaturesFlagsUpdateSeed = tenantFeatures
  ) =>
    request(api)
      .post("/tenants/delegatedFeatures/update")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: operationForbidden, expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.updateTenantDelegatedFeatures = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { isDelegatedConsumerFeatureEnabled: true } },
    { body: { ...tenantFeatures, isDelegatedConsumerFeatureEnabled: 1 } },
    { body: { ...tenantFeatures, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as tenantApi.TenantDelegatedFeaturesFlagsUpdateSeed
    );
    expect(res.status).toBe(400);
  });
});
