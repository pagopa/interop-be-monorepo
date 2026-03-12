import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockDPoPProof,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  agreementNotInPendingState,
  missingMetadata,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /agreements/:agreementId/approve router test", () => {
  const mockApiAgreement = getMockedApiAgreement({
    state: agreementApi.AgreementState.Values.PENDING,
  });

  const mockM2MAgreementResponse: m2mGatewayApiV3.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement, generateId());

  const makeRequest = async (
    token: string,
    agreementId: string = mockApiAgreement.id,
    body: m2mGatewayApiV3.DelegationRef | undefined = {
      delegationId: generateId(),
    }
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/approve`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.approveAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it("Should return 200 when no body is passed", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiAgreement.id, undefined);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockM2MAgreementResponse);
  });

  it.each([
    { delegationId: "INVALID ID" },
    {
      unsupportedField: "unsupportedValue",
    },
  ])("Should return 400 for incorrect value for body", async (body) => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiAgreement.id, body);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockAgreementService.approveAgreement = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it("Should return 409 in case of agreementNotInPendingState error", async () => {
    mockAgreementService.approveAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotInPendingState(mockApiAgreement.id));
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
      mockAgreementService.approveAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
