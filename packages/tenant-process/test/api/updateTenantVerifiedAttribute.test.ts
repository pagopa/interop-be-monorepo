/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
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
  expirationDateCannotBeInThePast,
  organizationNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../../src/model/domain/errors.js";

describe("API POST /tenants/{tenantId}/attributes/verified/{attributeId} test", () => {
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
  const attributeId = tenant.attributes.map((a) => a.id)[0];

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.updateTenantVerifiedAttribute = vi
      .fn()
      .mockResolvedValue(tenant);
  });

  const makeRequest = async (token: string, tenantId: string = tenant.id) =>
    request(api)
      .post(`/tenants/${tenantId}/attributes/verified/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
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
    {
      error: verifiedAttributeNotFoundInTenant(tenant.id, attributeId),
      expectedStatus: 404,
    },
    {
      error: expirationDateCannotBeInThePast(expirationDate),
      expectedStatus: 400,
    },
    {
      error: organizationNotFoundInVerifiers(
        "requesterId",
        tenant.id,
        attributeId
      ),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.updateTenantVerifiedAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
