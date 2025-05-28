/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  AgreementId,
  AttributeId,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
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
  const defaultBody: { agreementId: AgreementId } = {
    agreementId: generateId(),
  };

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.revokeVerifiedAttribute = vi.fn().mockResolvedValue(tenant);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    attributeId: AttributeId = generateId(),
    body: { agreementId: AgreementId } = defaultBody
  ) =>
    request(api)
      .delete(`/tenants/${tenantId}/attributes/verified/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role %s", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
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

  it.each([
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
    { body: {} },
    { body: { agreementId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        attributeId,
        body as { agreementId: AgreementId }
      );
      expect(res.status).toBe(400);
    }
  );
});
