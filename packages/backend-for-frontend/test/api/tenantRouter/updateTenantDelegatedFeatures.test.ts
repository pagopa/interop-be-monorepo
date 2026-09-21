/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiTenantDelegatedFeaturesFlagsUpdateSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /tenants/delegatedFeatures/update test", () => {
  const updateSeed = getMockBffApiTenantDelegatedFeaturesFlagsUpdateSeed();

  beforeEach(() => {
    clients.tenantProcessClient.tenant.updateTenantDelegatedFeatures = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.TenantDelegatedFeaturesFlagsUpdateSeed = updateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/delegatedFeatures/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { body: {} },
    { body: { isDelegatedConsumerFeatureEnabled: true } },
    { body: { isDelegatedProducerFeatureEnabled: true } },
    { body: { ...updateSeed, isDelegatedConsumerFeatureEnabled: "invalid" } },
    { body: { ...updateSeed, isDelegatedProducerFeatureEnabled: "invalid" } },
    { body: { ...updateSeed, extraField: true } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as bffApi.TenantDelegatedFeaturesFlagsUpdateSeed
    );
    expect(res.status).toBe(400);
  });
});
