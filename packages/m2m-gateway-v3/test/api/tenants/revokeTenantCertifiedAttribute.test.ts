/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiCertifiedTenantAttribute,
  getMockedApiTenant,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  TenantId,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, mockTenantService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  tenantCertifiedAttributeNotFound,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiTenantCertifiedAttribute } from "../../../src/api/tenantApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /tenants/:tenantId/certifiedAttributes/:attributeId router test", () => {
  const mockApiResponse = getMockedApiCertifiedTenantAttribute();
  const mockResponse = toM2MGatewayApiTenantCertifiedAttribute(mockApiResponse);

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    attributeId: AttributeId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${tenantId}/certifiedAttributes/${attributeId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.revokeTenantCertifiedAttribute = vi
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

  it("Should return 400 if passed an invalid tenant id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid_id" as TenantId);

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid attribute id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId<TenantId>(),
      "invalid_id" as AttributeId
    );

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
    mockTenantService.revokeTenantCertifiedAttribute = vi
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
      mockTenantService.revokeTenantCertifiedAttribute = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
