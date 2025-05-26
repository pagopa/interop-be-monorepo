/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiTenant } from "../../../src/api/tenantApiConverter.js";
import { getMockedApiTenant } from "../../mockUtils.js";

describe("POST /tenants/:tenantId/certifiedAttributes router test", () => {
  const mockApiResponse = getMockedApiTenant();
  const mockResponse: m2mGatewayApi.Tenant = toM2MGatewayApiTenant(
    mockApiResponse.data
  );

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.TenantCertifiedAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${generateId()}/certifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.addCertifiedAttribute = vi
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

  it("Should return 400 if passed an invalid seed", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, {
      invalidParam: "invalidValue",
    } as unknown as m2mGatewayApi.TenantCertifiedAttributeSeed);

    expect(res.status).toBe(400);
  });

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockTenantService.addCertifiedAttribute = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, { id: generateId() });

      expect(res.status).toBe(500);
    }
  );
});
