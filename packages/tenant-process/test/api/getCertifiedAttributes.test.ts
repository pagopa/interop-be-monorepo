/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Attribute,
  attributeKind,
  generateId,
  TenantAttribute,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { getMockCertifiedTenantAttribute } from "../mockUtils.js";
import {
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API /tenants/attributes/certified authorization test", () => {
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

  vi.spyOn(tenantService, "getCertifiedAttributes").mockResolvedValue(
    mockResponse
  );

  const allowedRoles: UserRole[] = [
    userRoles.ADMIN_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
  ];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .get("/tenants/attributes/certified")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

  it.each(allowedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
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
    vi.spyOn(tenantService, "getCertifiedAttributes").mockRejectedValue(
      tenantNotFound(tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    vi.spyOn(tenantService, "getCertifiedAttributes").mockRejectedValue(
      tenantIsNotACertifier(tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
