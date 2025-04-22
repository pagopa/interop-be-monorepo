/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, operationForbidden } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";

describe("API /tenants/delegatedFeatures/update authorization test", () => {
  const tenantFeatures = {
    isDelegatedConsumerFeatureEnabled: true,
    isDelegatedProducerFeatureEnabled: false,
  };

  vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockResolvedValue();

  const makeRequest = async (token: string) =>
    request(api)
      .post("/tenants/delegatedFeatures/update")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(tenantFeatures);

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

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockRejectedValue(
      tenantNotFound(generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockRejectedValue(
      operationForbidden
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
