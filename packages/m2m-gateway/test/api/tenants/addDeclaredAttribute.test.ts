/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDeclaredTenantAttribute,
} from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiTenantDeclaredAttribute } from "../../../src/api/tenantApiConverter.js";

describe("POST /tenants/:tenantId/declaredAttributes router test", () => {
  const mockApiResponse = getMockedApiDeclaredTenantAttribute();
  const mockResponse = toM2MGatewayApiTenantDeclaredAttribute(mockApiResponse);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.TenantDeclaredAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${generateId()}/declaredAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.addDeclaredAttribute = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, { id: generateId() });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, { id: generateId() });

    expect(res.status).toBe(403);
  });

  it("Should return 500 when service throws generic error", async () => {
    mockTenantService.addDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(new Error("Something went wrong"));

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, { id: generateId() });

    expect(res.status).toBe(500);
  });

  it("Should return 409 when service throws pollingMaxRetriesExceeded error", async () => {
    mockTenantService.addDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(pollingMaxRetriesExceeded(3, 10));

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, { id: generateId() });

    expect(res.status).toBe(409);
  });

  it("Should return 500 when service throws missingMetadata error", async () => {
    mockTenantService.addDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(missingMetadata());

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, { id: generateId() });

    expect(res.status).toBe(500);
  });
});
