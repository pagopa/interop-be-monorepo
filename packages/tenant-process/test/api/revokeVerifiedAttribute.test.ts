/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
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

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  beforeEach(() => {
    tenantService.revokeVerifiedAttribute = vi.fn().mockResolvedValue(tenant);
  });

  const makeRequest = async (
    token: string,
    tenantId: string = tenant.id,
    attributeId: string = generateId()
  ) =>
    request(api)
      .delete(`/tenants/${tenantId}/attributes/verified/${attributeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ agreementId: generateId() });

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

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for attributeNotFound", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 404 for agreementNotFound", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(agreementNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for descriptorNotFoundInEservice", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        descriptorNotFoundInEservice(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for verifiedAttributeSelfRevocationNotAllowed", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(verifiedAttributeSelfRevocationNotAllowed());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for attributeRevocationNotAllowed", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeRevocationNotAllowed(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for attributeAlreadyRevoked", async () => {
    tenantService.revokeVerifiedAttribute = vi
      .fn()
      .mockRejectedValue(
        attributeAlreadyRevoked(generateId(), generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
