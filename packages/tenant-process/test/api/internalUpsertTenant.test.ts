/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { generateId, Tenant } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";

describe("API POST /internal/tenants test", () => {
  const tenantSeed: tenantApi.InternalTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
  };
  const tenant: Tenant = getMockTenant();

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  tenantService.internalUpsertTenant = vi.fn().mockResolvedValue(tenant);

  const makeRequest = async (token: string, data: object = tenantSeed) =>
    request(api)
      .post("/internal/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 200 for user with role Internal", async () => {
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

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(tenantNotFound(tenant.id));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for attributeNotFound", async () => {
    tenantService.internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for certifiedAttributeAlreadyAssigned", async () => {
    tenantService.internalUpsertTenant = vi
      .fn()
      .mockRejectedValue(
        certifiedAttributeAlreadyAssigned(generateId(), generateId())
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid tenant seed", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, {
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      certifiedAttributes: [{ origin: "ORIGIN", code: "CODE" }],
    });
    expect(res.status).toBe(400);
  });
});
