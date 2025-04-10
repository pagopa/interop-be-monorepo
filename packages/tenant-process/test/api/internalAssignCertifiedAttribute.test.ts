/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  Attribute,
  attributeKind,
  generateId,
  Tenant,
} from "pagopa-interop-models";
import {
  createPayload,
  getMockAttribute,
  getMockAuthData,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { UserRole, userRoles } from "pagopa-interop-commons";
import { api } from "../vitest.api.setup.js";
import { tenantService } from "../../src/routers/TenantRouter.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  tenantNotFound,
} from "../../src/model/domain/errors.js";

describe("API /internal/origin/{tOrigin}/externalId/{tExternalId}/attributes/origin/{aOrigin}/externalId/{aExternalId} authorization test", () => {
  const attribute: Attribute = {
    ...getMockAttribute(),
    origin: "ORIGIN",
    code: "CODE",
    kind: attributeKind.certified,
  };
  const targetTenant: Tenant = {
    ...getMockTenant(),
    attributes: [],
  };

  vi.spyOn(
    tenantService,
    "internalAssignCertifiedAttribute"
  ).mockResolvedValue();

  const allowedRoles: UserRole[] = [userRoles.INTERNAL_ROLE];

  const generateToken = (userRole: UserRole = allowedRoles[0]) =>
    jwt.sign(
      createPayload({ ...getMockAuthData(), userRoles: [userRole] }),
      "test-secret"
    );

  const makeRequest = async (token: string) =>
    request(api)
      .post(
        `/internal/origin/${targetTenant.externalId.origin}/externalId/${targetTenant.externalId.value}/attributes/origin/${attribute.origin}/externalId/${attribute.code}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it.each(allowedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(userRoles).filter((role) => !allowedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for tenantNotFound", async () => {
    vi.spyOn(
      tenantService,
      "internalAssignCertifiedAttribute"
    ).mockRejectedValue(tenantNotFound(targetTenant.id));
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for attributeNotFound", async () => {
    vi.spyOn(
      tenantService,
      "internalAssignCertifiedAttribute"
    ).mockRejectedValue(attributeNotFound(generateId()));
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for certifiedAttributeAlreadyAssigned", async () => {
    vi.spyOn(
      tenantService,
      "internalAssignCertifiedAttribute"
    ).mockRejectedValue(
      certifiedAttributeAlreadyAssigned(generateId(), generateId())
    );
    const token = generateToken();
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });
});
