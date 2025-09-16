/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant, TenantId } from "pagopa-interop-models";
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
  agreementNotFound,
  attributeNotFound,
  attributeVerificationNotAllowed,
  descriptorNotFoundInEservice,
  eServiceNotFound,
  tenantNotFound,
  verifiedAttributeSelfVerificationNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/attributes/verified test", () => {
  const tenant: Tenant = getMockTenant();
  const defaultBody: tenantApi.VerifiedTenantAttributeSeed = {
    id: generateId(),
    agreementId: generateId(),
  };

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  const serviceResponse = getMockWithMetadata(tenant);
  tenantService.verifyVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: tenantApi.VerifiedTenantAttributeSeed = defaultBody
  ) =>
    request(api)
      .post(`/tenants/${tenantId}/attributes/verified`)
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
    { error: agreementNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    {
      error: descriptorNotFoundInEservice(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: verifiedAttributeSelfVerificationNotAllowed(),
      expectedStatus: 403,
    },
    {
      error: attributeVerificationNotAllowed(generateId(), generateId()),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.verifyVerifiedAttribute = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { id: generateId() } },
    { body: { ...defaultBody, id: 1 } },
    { body: { ...defaultBody, id: "invalid" } },
    { body: { ...defaultBody, agreementId: 1 } },
    { body: { ...defaultBody, agreementId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as tenantApi.VerifiedTenantAttributeSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
