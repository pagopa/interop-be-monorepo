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
import { api, tenantService } from "../vitest.api.setup.js";
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

  tenantService.m2mRevokeCertifiedAttribute = vi
    .fn()
    .mockResolvedValue(undefined);

  const makeRequest = async (token: string) =>
    request(api)
      .delete(
        `/m2m/origin/${targetTenant.externalId.origin}/externalId/${targetTenant.externalId.value}/attributes/${mockAttribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

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
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(tenantNotFound(targetTenant.id));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantNotFoundByExternalId", async () => {
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
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
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(attributeNotFound(mockAttribute.code));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for attributeNotFoundInTenant", async () => {
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(
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
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockRejectedValue(tenantIsNotACertifier(targetTenant.id));
    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
