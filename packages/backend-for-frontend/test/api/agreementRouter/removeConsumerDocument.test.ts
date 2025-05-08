/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it, vi } from "vitest";
import {
  AgreementDocumentId,
  AgreementId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { agreementService, api } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";

describe("API DELETE /agreements/:agreementId/consumer-documents/:documentId", () => {
  const mockAgreementId = generateId<AgreementId>();
  const mockDocumentId = generateId<AgreementDocumentId>();

  agreementService.removeConsumerDocument = vi
    .fn()
    .mockResolvedValue(undefined);

  const makeRequest = async (
    token: string,
    documentId: string = mockDocumentId
  ) =>
    request(api)
      .delete(
        `/backend-for-frontend/${config.backendForFrontendInterfaceVersion}/agreements/${mockAgreementId}/consumer-documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
