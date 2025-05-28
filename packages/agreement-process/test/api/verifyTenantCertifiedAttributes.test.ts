/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  descriptorNotFound,
  eServiceNotFound,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /tenants/{tenantId}/eservices/{eserviceId}/descriptors/{descriptorId}/certifiedAttributes/validate test", () => {
  const result = { hasCertifiedAttributes: true };
  const apiResponse = result;

  beforeEach(() => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockResolvedValue(result);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    eserviceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId()
  ) =>
    request(api)
      .get(
        `/tenants/${tenantId}/eservices/${eserviceId}/descriptors/${descriptorId}/certifiedAttributes/validate`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

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
    { error: tenantNotFound(generateId()), expectedStatus: 404 },
    { error: eServiceNotFound(generateId()), expectedStatus: 400 },
    {
      error: descriptorNotFound(generateId(), generateId()),
      expectedStatus: 400,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.verifyTenantCertifiedAttributes = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { tenantId: "invalid" as TenantId },
    { eserviceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, eserviceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, tenantId, eserviceId, descriptorId);
      expect(res.status).toBe(400);
    }
  );
});
