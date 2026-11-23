/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { tenantApi } from "pagopa-interop-api-clients";
import { authRole, AuthRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  ContactId,
  featureFlagNotEnabled,
  generateId,
  operationForbidden,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  tenantContactAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API POST /tenants/{tenantId}/contact test", () => {
  const contactId = generateId<ContactId>();
  const contactSeed: tenantApi.TenantContactSeed = { contactId };
  const tenant: Tenant = { ...getMockTenant(), contactId };

  const serviceResponse = getMockWithMetadata(tenant);
  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.addTenantContact = vi.fn().mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  const makeRequest = async (
    token: string,
    tenantId: TenantId = tenant.id,
    body: tenantApi.TenantContactSeed = contactSeed
  ) =>
    request(api)
      .post(`/tenants/${tenantId}/contact`)
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
      expect(res.body.contactId).toBe(contactId);
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
    { error: operationForbidden, expectedStatus: 403 },
    {
      error: tenantContactAlreadyAssigned(tenant.id, contactId),
      expectedStatus: 409,
    },
    {
      error: featureFlagNotEnabled("featureFlagTenantEventsV3"),
      expectedStatus: 501,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.addTenantContact = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { body: {} },
    { body: { contactId: "invalid" } },
    { body: { ...contactSeed, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        body as tenantApi.TenantContactSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
