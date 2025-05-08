/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import { AgreementId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";

describe("API POST /agreements/:agreementId/consumer-documents", () => {
  const mockAgreementId = generateId<AgreementId>();
  const mockBuffer = Buffer.from("content");

  agreementService.addAgreementConsumerDocument = vi
    .fn()
    .mockResolvedValue(mockBuffer);

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreementId
  ) =>
    request(api)
      .post(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements/${agreementId}/consumer-documents`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .field("name", "name")
      .field("prettyName", "pretty name")
      .attach("doc", Buffer.from("content"), { filename: "test.txt" });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBuffer);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
