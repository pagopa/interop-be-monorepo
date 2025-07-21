/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  Tenant,
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

describe("API DELETE /m2m/origin/{origin}/externalId/{externalId}/attributes/{code} test", () => {
  const mockAttribute = { ...getMockAttribute(), code: generateId() };
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

  beforeEach(() => {
    tenantService.m2mRevokeCertifiedAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

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

  it.each([
    { error: tenantNotFound(targetTenant.id), expectedStatus: 404 },
    {
      error: tenantNotFoundByExternalId(
        targetTenant.externalId.origin,
        targetTenant.externalId.value
      ),
      expectedStatus: 404,
    },
    { error: attributeNotFound(mockAttribute.code), expectedStatus: 400 },
    {
      error: attributeNotFoundInTenant(
        unsafeBrandId(mockAttribute.code),
        targetTenant.id
      ),
      expectedStatus: 400,
    },
    { error: tenantIsNotACertifier(targetTenant.id), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      tenantService.m2mRevokeCertifiedAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
});
