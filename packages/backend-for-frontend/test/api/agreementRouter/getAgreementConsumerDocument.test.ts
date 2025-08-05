/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgreementDocumentId,
  AgreementId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { services, api } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /agreements/:agreementId/consumer-documents/:documentId", () => {
  const mockBuffer = Buffer.from("content");

  beforeEach(() => {
    services.agreementService.getAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockBuffer);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = generateId(),
    documentId: AgreementDocumentId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/agreements/${agreementId}/consumer-documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBuffer);
  });

  it.each([
    { agreementId: "invalid" as AgreementId },
    { documentId: "invalid" as AgreementDocumentId },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ agreementId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId, documentId);
      expect(res.status).toBe(400);
    }
  );
});
