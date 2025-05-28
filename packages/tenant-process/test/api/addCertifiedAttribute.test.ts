/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant, TenantId } from "pagopa-interop-models";
import {
  generateToken,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/attributes/certified test", () => {
  const tenantAttributeSeed: tenantApi.CertifiedTenantAttributeSeed = {
    id: generateId(),
  };
  const tenant: Tenant = getMockTenant();

  const serviceResponse = getMockWithMetadata(tenant);
  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.addCertifiedAttribute = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: tenantApi.CertifiedTenantAttributeSeed = tenantAttributeSeed
  ) =>
    request(api)
      .post(`/tenants/${tenantId}/attributes/certified`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

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
    { error: tenantIsNotACertifier(tenant.id), expectedStatus: 403 },
    { error: attributeNotFound(generateId()), expectedStatus: 400 },
    {
      error: attributeDoesNotBelongToCertifier(
        generateId(),
        generateId(),
        tenant.id
      ),
      expectedStatus: 403,
    },
    {
      error: certifiedAttributeAlreadyAssigned(generateId(), generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.addCertifiedAttribute = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { id: "invalid" } },
    { body: { ...tenantAttributeSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as tenantApi.CertifiedTenantAttributeSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
