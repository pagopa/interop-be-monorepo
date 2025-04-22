/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
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

describe("API /tenants/{tenantId}/attributes/verified/{attributeId} authorization test", () => {
  const tenant: Tenant = getMockTenant();
  const tenantId = tenant.id;
  const attributeId = generateId();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  vi.spyOn(tenantService, "revokeVerifiedAttribute").mockResolvedValue(tenant);

  const makeRequest = async (token: string) =>
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
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      tenantNotFound(tenant.id)
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for attributeNotFound", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      attributeNotFound(generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 404 for agreementNotFound", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      agreementNotFound(generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      eServiceNotFound(generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for descriptorNotFoundInEservice", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      descriptorNotFoundInEservice(generateId(), generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for verifiedAttributeSelfRevocationNotAllowed", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      verifiedAttributeSelfRevocationNotAllowed()
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for attributeRevocationNotAllowed", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      attributeRevocationNotAllowed(generateId(), generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for attributeAlreadyRevoked", async () => {
    vi.spyOn(tenantService, "revokeVerifiedAttribute").mockRejectedValue(
      attributeAlreadyRevoked(generateId(), generateId(), generateId())
    );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
