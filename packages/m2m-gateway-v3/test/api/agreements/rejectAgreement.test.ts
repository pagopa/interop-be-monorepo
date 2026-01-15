import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /agreements/:agreementId/reject router test", () => {
  const mockApiAgreement = getMockedApiAgreement({
    state: agreementApi.AgreementState.Values.PENDING,
  });

  const mockRejectAgreementBody: m2mGatewayApiV3.AgreementRejection = {
    reason: "This is a test reason for rejection",
  };

  const mockM2MAgreementResponse: m2mGatewayApiV3.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement, generateId());

  const makeRequest = async (
    token: string,
    body: m2mGatewayApiV3.AgreementRejection,
    agreementId: string = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.rejectAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockRejectAgreementBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAgreementService.rejectAgreement = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockRejectAgreementBody);

    expect(res.status).toBe(500);
  });

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.rejectAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, mockRejectAgreementBody, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockRejectAgreementBody, invalidParam: "invalidValue" },
    { reason: undefined },
  ])("Should return 400 if passed an invalid body", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as m2mGatewayApiV3.AgreementRejection
    );

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MAgreementResponse, state: "INVALID_STATE" },
    { ...mockM2MAgreementResponse, invalidParam: "invalidValue" },
    { ...mockM2MAgreementResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.rejectAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockRejectAgreementBody);

      expect(res.status).toBe(500);
    }
  );
});
