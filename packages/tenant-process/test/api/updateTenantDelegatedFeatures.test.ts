/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateId, operationForbidden } from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { tenantNotFound } from "../../src/model/domain/errors.js";

describe("API /tenants/delegatedFeatures/update authorization test", () => {
  const tenantFeatures = {
    isDelegatedConsumerFeatureEnabled: true,
    isDelegatedProducerFeatureEnabled: false,
  };

  vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockResolvedValue();

  const allowedRoles: UserRole[] = [userRoles.ADMIN_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post("/tenants/delegatedFeatures/update")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(tenantFeatures);

  it.each(allowedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => !allowedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockRejectedValue(
      tenantNotFound(generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for operationForbidden", async () => {
    vi.spyOn(tenantService, "updateTenantDelegatedFeatures").mockRejectedValue(
      operationForbidden
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
