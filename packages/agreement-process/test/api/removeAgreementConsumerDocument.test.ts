/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementDocumentId,
  AgreementId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementDocumentNotFound,
  documentsChangeNotAllowed,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("API DELETE /agreements/{agreementId}/consumer-documents/{documentId} test", () => {
  const mockAgreement = getMockAgreement();
  const mockConsumerDocument = getMockConsumerDocument(mockAgreement.id);

  beforeEach(() => {
    agreementService.removeAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    documentId: AgreementDocumentId = mockConsumerDocument.id
  ) =>
    request(api)
      .delete(`/agreements/${agreementId}/consumer-documents/${documentId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: agreementDocumentNotFound(
        mockConsumerDocument.id,
        mockAgreement.id
      ),
      expectedStatus: 404,
    },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
    {
      error: documentsChangeNotAllowed(agreementState.active),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.removeAgreementConsumerDocument = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" as AgreementId },
    { documentId: "invalid" as AgreementDocumentId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId, documentId);
      expect(res.status).toBe(400);
    }
  );
});
