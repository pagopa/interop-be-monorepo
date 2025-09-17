import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDeclaredTenantAttribute,
  getMockedApiDelegation,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  TenantId,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { toM2MGatewayApiTenantDeclaredAttribute } from "../../../src/api/tenantApiConverter.js";
import {
  tenantDeclaredAttributeNotFound,
  missingMetadata,
  requesterIsNotTheDelegateConsumer,
  cannotEditDeclaredAttributesForTenant,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("POST /tenants/:tenantId/declaredAttributes router test", () => {
  const mockApiResponse = getMockedApiDeclaredTenantAttribute();
  const mockResponse = toM2MGatewayApiTenantDeclaredAttribute(mockApiResponse);

  const mockSeed: m2mGatewayApi.TenantDeclaredAttributeSeed = {
    id: generateId(),
  };

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.TenantDeclaredAttributeSeed = mockSeed,
    tenantId: TenantId = generateId()
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/declaredAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.assignTenantDeclaredAttribute = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockSeed, invalidParam: "invalidValue" },
    { ...mockSeed, id: undefined },
    { ...mockSeed, id: "invalidId" },
  ] as m2mGatewayApi.TenantDeclaredAttributeSeed[])(
    "Should return 400 if passed an invalid seed",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, seed);

      expect(res.status).toBe(400);
    }
  );

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockSeed, "invalid_id" as TenantId);

    expect(res.status).toBe(400);
  });

  it.each([
    requesterIsNotTheDelegateConsumer(getMockedApiDelegation()),
    cannotEditDeclaredAttributesForTenant(
      generateId(),
      getMockedApiDelegation()
    ),
  ])("Should return 403 in case of $code error", async (error) => {
    mockTenantService.assignTenantDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });

  it.each([
    tenantDeclaredAttributeNotFound(getMockedApiTenant(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockTenantService.assignTenantDeclaredAttribute = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockResponse, id: undefined },
    { ...mockResponse, assignedAt: "INVALID_DATE" },
    { ...mockResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockTenantService.assignTenantDeclaredAttribute = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
