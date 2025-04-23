/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Tenant, generateId } from "pagopa-interop-models";
import { generateToken, getMockTenant } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { tenantApi } from "pagopa-interop-api-clients";
import { api, tenantService } from "../vitest.api.setup.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantIsNotACertifier,
  tenantNotFound,
  tenantNotFoundByExternalId,
} from "../../src/model/domain/errors.js";
import { toApiTenant } from "../../src/model/domain/apiConverter.js";

describe("API POST /m2m/tenants test", () => {
  const tenant: Tenant = getMockTenant();
  const tenantSeed: tenantApi.M2MTenantSeed = {
    externalId: {
      origin: "IPA",
      value: "123456",
    },
    name: "A tenant",
    certifiedAttributes: [{ code: "CODE" }],
  };

  const apiResponse = tenantApi.Tenant.parse(toApiTenant(tenant));

  tenantService.m2mUpsertTenant = vi.fn().mockResolvedValue(tenant);

  const makeRequest = async (token: string, data: object = tenantSeed) =>
    request(api)
      .post("/m2m/tenants")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

  it("Should return 200 for user with role M2M", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(Object.values(authRole).filter((role) => role !== authRole.M2M_ROLE))(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(403);
    }
  );

  it("Should return 404 for tenantNotFound", async () => {
    tenantService.m2mUpsertTenant = vi
      .fn()
      .mockRejectedValue(tenantNotFound(generateId()));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for attributeNotFound", async () => {
    tenantService.m2mUpsertTenant = vi
      .fn()
      .mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantNotFoundByExternalId", async () => {
    tenantService.m2mUpsertTenant = vi
      .fn()
      .mockRejectedValue(
        tenantNotFoundByExternalId(
          tenantSeed.externalId.origin,
          tenantSeed.externalId.value
        )
      );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for certifiedAttributeAlreadyAssigned", async () => {
    tenantService.m2mUpsertTenant = vi
      .fn()
      .mockRejectedValue(
        certifiedAttributeAlreadyAssigned(generateId(), generateId())
      );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    tenantService.m2mUpsertTenant = vi
      .fn()
      .mockRejectedValue(tenantIsNotACertifier(generateId()));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid tenant seed", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, {
      externalId: {
        origin: "IPA",
        value: "123456",
      },
      certifiedAttributes: [{ code: "CODE" }],
    });
    expect(res.status).toBe(400);
  });
});
