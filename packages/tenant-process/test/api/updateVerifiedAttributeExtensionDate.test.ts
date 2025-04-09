/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { generateId, Tenant } from "pagopa-interop-models";
import {
  createPayload,
  getMockAuthData,
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import { currentDate, getMockVerifiedBy } from "../mockUtils.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  expirationDateNotFoundInVerifier,
  organizationNotFoundInVerifiers,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../../src/model/domain/errors.js";

describe("API /tenants/{tenantId}/attributes/verified/{attributeId}/verifier/{verifierId} authorization test", () => {
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
  const verifierId = mockVerifiedBy.id;

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  vi.spyOn(
    tenantService,
    "updateVerifiedAttributeExtensionDate"
  ).mockResolvedValue(tenant);

  const allowedRoles: UserRole[] = [userRoles.INTERNAL_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post(
        `/tenants/${tenant.id}/attributes/verified/${attributeId}/verifier/${verifierId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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

  it("Should return 404 for verifiedAttributeNotFoundInTenant", async () => {
    vi.spyOn(
      tenantService,
      "updateVerifiedAttributeExtensionDate"
    ).mockRejectedValue(
      verifiedAttributeNotFoundInTenant(tenant.id, attributeId)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationNotFoundInVerifiers", async () => {
    vi.spyOn(
      tenantService,
      "updateVerifiedAttributeExtensionDate"
    ).mockRejectedValue(
      organizationNotFoundInVerifiers("requesterId", tenant.id, attributeId)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for expirationDateNotFoundInVerifier", async () => {
    vi.spyOn(
      tenantService,
      "updateVerifiedAttributeExtensionDate"
    ).mockRejectedValue(
      expirationDateNotFoundInVerifier(verifierId, attributeId, tenant.id)
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(
      tenantService,
      "updateVerifiedAttributeExtensionDate"
    ).mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });
});
