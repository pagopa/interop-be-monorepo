/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  descriptorNotFound,
  eServiceNotFound,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
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
    tenantId: string = generateId(),
    eserviceId: string = generateId(),
    descriptorId: string = generateId()
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

  it("Should return 404 for tenantNotFound", async () => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for eServiceNotFound", async () => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for descriptorNotFound", async () => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockRejectedValue(descriptorNotFound(generateId(), generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.verifyTenantCertifiedAttributes = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(generateId(), undefined)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
