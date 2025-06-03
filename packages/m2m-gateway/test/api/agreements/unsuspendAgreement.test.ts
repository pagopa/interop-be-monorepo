import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  agreementNotInSuspendedState,
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("POST /agreements/:agreementId/unsuspend router test", () => {
  const mockApiAgreement = getMockedApiAgreement({
    state: agreementApi.AgreementState.Values.PENDING,
  });

  const mockM2MAgreementResponse: m2mGatewayApi.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement);

  const makeRequest = async (
    token: string,
    agreementId: string = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/unsuspend`)
      .set("Authorization", `Bearer ${token}`);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.unsuspendAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.unsuspendAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockAgreementService.unsuspendAgreement = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 409 in case of agreementNotInSuspendedState error", async () => {
    mockAgreementService.unsuspendAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotInSuspendedState(mockApiAgreement.id));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(409);
  });

  it.each([
    { ...mockM2MAgreementResponse, state: "INVALID_STATE" },
    { ...mockM2MAgreementResponse, invalidParam: "invalidValue" },
    { ...mockM2MAgreementResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.unsuspendAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
