import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiAgreement,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayApiAgreement } from "../../../src/api/agreementApiConverter.js";

describe("POST /agreements/:agreementId/submit router test", () => {
  const mockApiAgreement = getMockedApiAgreement();

  const mockSubmitAgreementBody: m2mGatewayApi.AgreementSubmission = {
    consumerNotes: "This is a test note",
  };

  const mockM2MAgreementResponse: m2mGatewayApi.Agreement =
    toM2MGatewayApiAgreement(mockApiAgreement);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.AgreementSubmission,
    agreementId: string = mockApiAgreement.id
  ) =>
    request(api)
      .post(`${appBasePath}/agreements/${agreementId}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockAgreementService.submitAgreement = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockSubmitAgreementBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MAgreementResponse);
    }
  );

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockAgreementService.submitAgreement = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockSubmitAgreementBody);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 400 if passed an invalid body", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockSubmitAgreementBody,
      invalidParam: "invalidValue",
    } as m2mGatewayApi.AgreementSubmission);

    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.submitAgreement = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, mockSubmitAgreementBody, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MAgreementResponse, state: "INVALID_STATE" },
    { ...mockM2MAgreementResponse, invalidParam: "invalidValue" },
    { ...mockM2MAgreementResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.submitAgreement = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockSubmitAgreementBody);

      expect(res.status).toBe(500);
    }
  );
});
