/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiVerifiedTenantAttribute,
  getMockedApiTenant,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
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
  tenantVerifiedAttributeNotFound,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiTenantVerifiedAttribute } from "../../../src/api/tenantApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /tenants/:tenantId/verifiedAttributes/:attributeId router test", () => {
  const mockApiResponse = getMockedApiVerifiedTenantAttribute();
  const mockResponse = toM2MGatewayApiTenantVerifiedAttribute(mockApiResponse);

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    attributeId: AttributeId = generateId(),
    agreementId: AgreementId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${tenantId}/verifiedAttributes/${attributeId}`
      )
      .query({ agreementId })
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockTenantService.revokeTenantVerifiedAttribute = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockResponse);
    }
  );

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

  it("Should return 400 if passed an invalid agreement id query param", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId<TenantId>(),
      generateId<AttributeId>(),
      "invalid_id" as AgreementId
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if agreementId query param is missing", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await request(api)
      .delete(
        `${appBasePath}/tenants/${generateId()}/verifiedAttributes/${generateId()}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

    expect(res.status).toBe(400);
  });

  it.each([
    tenantVerifiedAttributeNotFound(getMockedApiTenant(), generateId()),
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockTenantService.revokeTenantVerifiedAttribute = vi
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
      mockTenantService.revokeTenantVerifiedAttribute = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
