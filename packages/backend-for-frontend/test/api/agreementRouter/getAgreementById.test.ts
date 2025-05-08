/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import { getMockApiAgreement } from "../../mockUtils.js";
import { agreementDescriptorNotFound } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("API GET /agreements/:agreementId", () => {
  const mockAgreementId = generateId<AgreementId>();
  const mockApiAgreement = getMockApiAgreement();

  services.agreementService.getAgreementById = vi
    .fn()
    .mockResolvedValue(mockApiAgreement);

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreementId
  ) =>
    request(api)
      .get(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements/${agreementId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiAgreement);
  });

  it("Should return 500 for agreementDescriptorNotFound", async () => {
    services.agreementService.getAgreementById = vi
      .fn()
      .mockRejectedValue(agreementDescriptorNotFound(mockAgreementId));
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
