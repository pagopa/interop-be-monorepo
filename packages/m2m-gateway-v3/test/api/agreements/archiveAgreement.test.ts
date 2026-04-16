import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  ApiError,
  generateId,
  pollingMaxRetriesExceeded,
  TenantId,
} from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /agreements/:agreementId/archive router test", () => {
  const mockApiAgreement = getMockedApiAgreement();

  const mockM2MAgreementResponse: m2mGatewayApiV3.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement, generateId());

  const makeRequest = async (
    token: string,
    agreementId: string = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/archive`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.archiveAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.archiveAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAgreementService.archiveAgreement = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    {
      error: new ApiError({
        code: "agreementNotFound",
        title: "Agreement not found",
        detail: "Agreement not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "agreementNotInExpectedState",
        title: "Agreement not in expected state",
        detail: "Agreement not in expected state",
      }),
      status: 400,
    },
    {
      error: new ApiError({
        code: "tenantIsNotTheConsumer",
        title: "Tenant is not the consumer",
        detail: "Tenant is not the consumer",
      }),
      status: 403,
    },
    {
      error: new ApiError({
        code: "tenantIsNotTheDelegateConsumer",
        title: "Tenant is not the delegate consumer",
        detail: `Tenant ${generateId<TenantId>()} is not the delegate consumer`,
      }),
      status: 403,
    },
  ])("Should return $status for mapped process errors", async ({ error, status }) => {
    mockAgreementService.archiveAgreement = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(status);
  });

  it.each([
    { ...mockM2MAgreementResponse, state: "INVALID_STATE" },
    { ...mockM2MAgreementResponse, invalidParam: "invalidValue" },
    { ...mockM2MAgreementResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.archiveAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
