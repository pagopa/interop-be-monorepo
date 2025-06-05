/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCertifiedAttributesResponse } from "../../mockUtils.js";

describe("API GET /tenants/{tenantId}/attributes/certified test", () => {
  const mockAttributes = getMockBffApiCertifiedAttributesResponse();

  beforeEach(() => {
    services.tenantService.getCertifiedAttributes = vi
      .fn()
      .mockResolvedValue(mockAttributes);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/tenants/${tenantId}/attributes/certified`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockAttributes);
  });

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as TenantId);
    expect(res.status).toBe(400);
  });
});
