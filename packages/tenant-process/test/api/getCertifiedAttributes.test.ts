/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Attribute,
  attributeKind,
  generateId,
  TenantAttribute,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { getMockCertifiedTenantAttribute } from "../mockUtils.js";
import {
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /tenants/attributes/certified test", () => {
  const certifierId = generateId();
  const tenant = getMockTenant();

  const tenantCertifiedAttribute1: TenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    revocationTimestamp: undefined,
  };
  const tenantCertifiedAttribute2: TenantAttribute = {
    ...getMockCertifiedTenantAttribute(),
    revocationTimestamp: undefined,
  };

  const certifiedAttribute1: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: certifierId,
    id: tenantCertifiedAttribute1.id,
  };
  const certifiedAttribute2: Attribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: certifierId,
    id: tenantCertifiedAttribute2.id,
  };

  const mockResponse = {
    results: [
      {
        attributeId: certifiedAttribute1.id,
        attributeName: certifiedAttribute1.name,
        id: tenant.id,
        name: tenant.name,
      },
      {
        attributeId: certifiedAttribute2.id,
        attributeName: certifiedAttribute2.name,
        id: tenant.id,
        name: tenant.name,
      },
    ],
    totalCount: 2,
  };

  const apiResponse = tenantApi.CertifiedAttributes.parse({
    results: mockResponse.results,
    totalCount: mockResponse.totalCount,
  });

  beforeEach(() => {
    tenantService.getCertifiedAttributes = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  const makeRequest = async (token: string, limit: unknown = 10) =>
    request(api)
      .get("/tenants/attributes/certified")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit });

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.getCertifiedAttributes = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid limit", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
