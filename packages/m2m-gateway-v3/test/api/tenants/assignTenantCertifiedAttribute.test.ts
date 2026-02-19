/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiCertifiedTenantAttribute,
  getMockedApiTenant,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  TenantId,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  tenantCertifiedAttributeNotFound,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiTenantCertifiedAttribute } from "../../../src/api/tenantApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /tenants/:tenantId/certifiedAttributes router test", () => {
  const mockApiResponse = getMockedApiCertifiedTenantAttribute();
  const mockResponse = toM2MGatewayApiTenantCertifiedAttribute(mockApiResponse);

  const mockSeed: m2mGatewayApiV3.TenantCertifiedAttributeSeed = {
    id: generateId(),
  };

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.TenantCertifiedAttributeSeed = mockSeed,
    tenantId: TenantId = generateId()
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/${tenantId}/certifiedAttributes`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.assignTenantCertifiedAttribute = vi
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
  ] as m2mGatewayApiV3.TenantCertifiedAttributeSeed[])(
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
    tenantCertifiedAttributeNotFound(getMockedApiTenant(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockTenantService.assignTenantCertifiedAttribute = vi
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
      mockTenantService.assignTenantCertifiedAttribute = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
