/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import {
  contractException,
  contractNotFound,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("API GET /agreements/:agreementId/contract", () => {
  const mockAgreementId = generateId<AgreementId>();
  const mockBuffer = Buffer.from("content");

  agreementService.getAgreementContract = vi.fn().mockResolvedValue(mockBuffer);

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreementId
  ) =>
    request(api)
      .get(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements/${agreementId}/contract`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toBe(mockBuffer);
  });

  it("Should return 404 for contractNotFound", async () => {
    agreementService.getAgreementContract = vi
      .fn()
      .mockRejectedValue(contractNotFound(mockAgreementId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 500 for contractException", async () => {
    agreementService.getAgreementContract = vi
      .fn()
      .mockRejectedValue(contractException(mockAgreementId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(500);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
