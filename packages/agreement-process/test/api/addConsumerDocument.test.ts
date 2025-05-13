/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementState, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementDocumentAlreadyExists,
  agreementNotFound,
  documentsChangeNotAllowed,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
  organizationNotAllowed,
} from "../../src/model/domain/errors.js";
import { agreementDocumentToApiAgreementDocument } from "../../src/model/domain/apiConverter.js";
import { getMockConsumerDocument, getMockDocumentSeed } from "../mockUtils.js";

describe("API POST /agreements/{agreementId}/consumer-documents test", () => {
  const mockAgreement = getMockAgreement();
  const mockConsumerDocument = getMockConsumerDocument(mockAgreement.id);
  const defaultBody = getMockDocumentSeed(mockConsumerDocument);

  const apiResponse = agreementApi.Document.parse(
    agreementDocumentToApiAgreementDocument(mockConsumerDocument)
  );

  beforeEach(() => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockConsumerDocument);
  });

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreement.id,
    body: object = defaultBody
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/consumer-documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body).toEqual(apiResponse);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    { error: organizationIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: organizationIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
    { error: organizationNotAllowed(generateId()), expectedStatus: 403 },
    {
      error: documentsChangeNotAllowed(agreementState.active),
      expectedStatus: 403,
    },
    {
      error: agreementDocumentAlreadyExists(mockAgreement.id),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      agreementService.addConsumerDocument = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { agreementId: "invalid" },
    { body: {} },
    { body: { ...defaultBody, id: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, agreementId, body);
      expect(res.status).toBe(400);
    }
  );
});
