/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  Tenant,
  attributeKind,
  generateId,
  tenantAttributeType,
  tenantKind,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockAttribute,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import {
  attributeNotFound,
  attributeNotFoundInTenant,
  tenantIsNotACertifier,
  tenantNotFound,
  tenantNotFoundByExternalId,
} from "../../src/model/domain/errors.js";

describe("API /m2m/origin/{origin}/externalId/{externalId}/attributes/{code} authorization test", () => {
  const certifierId = generateId();
  const mockAttribute = {
    ...getMockAttribute(),
    kind: attributeKind.certified,
    origin: certifierId,
    code: generateId(),
  };
  const targetTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
    attributes: [
      {
        id: mockAttribute.id,
        type: tenantAttributeType.CERTIFIED,
        assignmentTimestamp: new Date(),
      },
    ],
  };

  vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockResolvedValue();

  const makeRequest = async (token: string) =>
    request(api)
      .delete(
        `/m2m/origin/${targetTenant.externalId.origin}/externalId/${targetTenant.externalId.value}/attributes/${mockAttribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role M2M", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
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
    vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockRejectedValue(
      tenantNotFound(targetTenant.id)
    );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantNotFoundByExternalId", async () => {
    vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockRejectedValue(
      tenantNotFoundByExternalId(
        targetTenant.externalId.origin,
        targetTenant.externalId.value
      )
    );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for attributeNotFound", async () => {
    vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockRejectedValue(
      attributeNotFound(mockAttribute.code)
    );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for attributeNotFoundInTenant", async () => {
    vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockRejectedValue(
      attributeNotFoundInTenant(
        unsafeBrandId(mockAttribute.code),
        targetTenant.id
      )
    );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for tenantIsNotACertifier", async () => {
    vi.spyOn(tenantService, "m2mRevokeCertifiedAttribute").mockRejectedValue(
      tenantIsNotACertifier(targetTenant.id)
    );
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
