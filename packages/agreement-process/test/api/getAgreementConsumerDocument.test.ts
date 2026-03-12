/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AgreementDocumentId,
  AgreementId,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementDocumentToApiAgreementDocument } from "../../src/model/domain/apiConverter.js";
import {
  agreementDocumentNotFound,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("API GET /agreements/{agreementId}/consumer-documents/{documentId} test", () => {
  const mockAgreement = getMockAgreement();
  const mockConsumerDocument = getMockConsumerDocument(mockAgreement.id);

  const apiResponse = agreementApi.Document.parse(
    agreementDocumentToApiAgreementDocument(mockConsumerDocument)
  );

  beforeEach(() => {
    agreementService.getAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockConsumerDocument);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = generateId(),
    documentId: AgreementDocumentId = mockConsumerDocument.id
  ) =>
    request(api)
      .get(`/agreements/${agreementId}/consumer-documents/${documentId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.M2M_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: agreementDocumentNotFound(
        mockConsumerDocument.id,
        mockAgreement.id
      ),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.getAgreementConsumerDocument = vi
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
