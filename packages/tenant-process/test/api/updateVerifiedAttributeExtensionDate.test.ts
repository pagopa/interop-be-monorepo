/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  AttributeId,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import { currentDate, getMockVerifiedBy } from "../mockUtils.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  expirationDateNotFoundInVerifier,
  tenantNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/attributes/verified/{attributeId}/verifier/{verifierId} test", () => {
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );
  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const tenant: Tenant = {
    ...getMockTenant(),
    attributes: [
      {
        ...mockVerifiedTenantAttribute,
        verifiedBy: [
          {
            ...mockVerifiedBy,
            expirationDate,
          },
        ],
      },
    ],
  };
  const mockAttributeId = tenant.attributes.map((a) => a.id)[0];
  const mockVerifierId = mockVerifiedBy.id;

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.updateVerifiedAttributeExtensionDate = vi
      .fn()
      .mockResolvedValue(tenant);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    attributeId: AttributeId = mockAttributeId,
    verifierId: string = mockVerifierId
  ) =>
    request(api)
      .post(
        `/tenants/${tenantId}/attributes/verified/${attributeId}/verifier/${verifierId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role %s", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: verifiedAttributeNotFoundInTenant(tenant.id, mockAttributeId),
      expectedStatus: 404,
    },
    {
      error: tenantNotFoundInVerifiers(
        "requesterId",
        tenant.id,
        mockAttributeId
      ),
      expectedStatus: 403,
    },
    {
      error: expirationDateNotFoundInVerifier(
        mockVerifierId,
        mockAttributeId,
        tenant.id
      ),
      expectedStatus: 400,
    },
    { error: tenantNotFound(tenant.id), expectedStatus: 404 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.updateVerifiedAttributeExtensionDate = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
    { verifierId: "invalid" },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId, verifierId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, attributeId, verifierId);
      expect(res.status).toBe(400);
    }
  );
});
