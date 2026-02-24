/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import {
  contractException,
  contractNotFound,
} from "../../../src/model/errors.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /agreements/:agreementId/signedContract", () => {
  const mockBuffer = Buffer.from("content");

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/agreements/${agreementId}/signedContract`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    services.agreementService.getAgreementSignedContract = vi
      .fn()
      .mockResolvedValue(mockBuffer);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBuffer);
  });

  it.each([
    { error: contractNotFound(generateId()), expectedStatus: 404 },
    { error: contractException(generateId()), expectedStatus: 503 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.agreementService.getAgreementSignedContract = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid agreementId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as AgreementId);
    expect(res.status).toBe(400);
  });
});
