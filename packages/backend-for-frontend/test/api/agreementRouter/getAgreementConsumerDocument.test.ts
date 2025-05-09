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
  const mockAgreementId = generateId<AgreementId>();
  const mockDocumentId = generateId<AgreementDocumentId>();
  const mockBuffer = Buffer.from("content");

  const makeRequest = async (
    token: string,
    documentId: string = mockDocumentId
  ) =>
    request(api)
      .get(
        `${appBasePath}/agreements/${mockAgreementId}/consumer-documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    services.agreementService.getAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockBuffer);
  });

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
