/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import {
  generateToken,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  attributeNotFound,
  delegationNotFound,
  operationRestrictedToDelegate,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/attributes/declared test", () => {
  const tenant: Tenant = getMockTenant();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  const serviceResponse = getMockWithMetadata(tenant);
  tenantService.addDeclaredAttribute = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    body: tenantApi.DeclaredTenantAttributeSeed = { id: generateId() }
  ) =>
    request(api)
      .post("/tenants/attributes/declared")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotFound(tenant.id), expectedStatus: 404 },
    { error: attributeNotFound(generateId()), expectedStatus: 404 },
    { error: delegationNotFound(generateId()), expectedStatus: 404 },
    { error: operationRestrictedToDelegate(), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.addDeclaredAttribute = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { body: {} },
    { body: { id: "invalid" } },
    { body: { id: generateId(), delegationId: "invalid" } },
    { body: { id: generateId(), extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as tenantApi.DeclaredTenantAttributeSeed
    );
    expect(res.status).toBe(400);
  });
});
