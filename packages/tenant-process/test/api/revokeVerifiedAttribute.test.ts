/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  AgreementId,
  AttributeId,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
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
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  descriptorNotFoundInEservice,
  eServiceNotFound,
  tenantNotFound,
  verifiedAttributeSelfRevocationNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API DELETE /tenants/{tenantId}/attributes/verified/{attributeId} test", () => {
  const tenant: Tenant = getMockTenant();
  const defaultAgreementId: AgreementId = generateId();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  const serviceResponse = getMockWithMetadata(tenant);
  tenantService.revokeVerifiedAttribute = vi
    .fn()
    .mockResolvedValue(serviceResponse);

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    attributeId: AttributeId = generateId(),
    agreementId: AgreementId = defaultAgreementId
  ) =>
    request(api)
      .delete(`/tenants/${tenantId}/attributes/verified/${attributeId}`)
      .query({ agreementId })
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const attributeId: AttributeId = generateId();
      const res = await makeRequest(token, tenant.id, attributeId);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
      expect(tenantService.revokeVerifiedAttribute).toHaveBeenLastCalledWith(
        {
          tenantId: tenant.id,
          attributeId,
          agreementId: defaultAgreementId,
        },
        expect.any(Object)
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
    { error: attributeNotFound(generateId()), expectedStatus: 400 },
    { error: agreementNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 404 },
    {
      error: descriptorNotFoundInEservice(generateId(), generateId()),
      expectedStatus: 404,
    },
    { error: verifiedAttributeSelfRevocationNotAllowed(), expectedStatus: 403 },
    {
      error: attributeRevocationNotAllowed(generateId(), generateId()),
      expectedStatus: 403,
    },
    {
      error: attributeAlreadyRevoked(generateId(), generateId(), generateId()),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.revokeVerifiedAttribute = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  const invalidRequests: Array<{
    tenantId?: TenantId;
    attributeId?: AttributeId;
    agreementId?: AgreementId;
  }> = [
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
    { agreementId: "invalid" as AgreementId },
  ];

  it.each(invalidRequests)(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId, agreementId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, attributeId, agreementId);
      expect(res.status).toBe(400);
    }
  );

  it("Should return 400 if agreementId is passed only in the body", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .delete(`/tenants/${tenant.id}/attributes/verified/${generateId()}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ agreementId: defaultAgreementId });

    expect(res.status).toBe(400);
  });
});
