/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { tenantApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockTenant,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  generateId,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toApiTenant } from "../../src/model/domain/apiConverter.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  tenantIsNotACertifier,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { api, tenantService } from "../vitest.api.setup.js";

describe("API DELETE /tenants/{tenantId}/attributes/certifiedDiscrete/{attributeId} test", () => {
  const tenant: Tenant = getMockTenant();

  const serviceResponse = getMockWithMetadata(tenant);
  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.revokeCertifiedDiscreteAttributeById = vi
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
    attributeId: AttributeId = generateId()
  ) =>
    request(api)
      .delete(
        `/tenants/${tenantId}/attributes/certifiedDiscrete/${attributeId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
    {
      error: attributeDoesNotBelongToCertifier(
        generateId(),
        generateId(),
        tenant.id
      ),
      expectedStatus: 403,
    },
    { error: tenantIsNotACertifier(generateId()), expectedStatus: 403 },
    {
      error: attributeAlreadyRevoked(generateId(), generateId(), generateId()),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.revokeCertifiedDiscreteAttributeById = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, attributeId);
      expect(res.status).toBe(400);
    }
  );
});
