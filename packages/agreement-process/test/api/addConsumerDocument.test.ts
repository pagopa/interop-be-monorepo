/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgreementId, agreementState, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockAgreement,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementDocumentAlreadyExists,
  agreementNotFound,
  documentsChangeNotAllowed,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { agreementDocumentToApiAgreementDocument } from "../../src/model/domain/apiConverter.js";
import { getMockConsumerDocument, getMockDocumentSeed } from "../mockUtils.js";

describe("API POST /agreements/{agreementId}/consumer-documents test", () => {
  const mockAgreement = getMockAgreement();
  const mockConsumerDocument = getMockConsumerDocument(mockAgreement.id);
  const serviceResponse = getMockWithMetadata(mockConsumerDocument);

  const defaultBody = getMockDocumentSeed(mockConsumerDocument);

  const apiResponse = agreementApi.Document.parse(
    agreementDocumentToApiAgreementDocument(mockConsumerDocument)
  );

  beforeEach(() => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    agreementId: AgreementId = mockAgreement.id,
    body: agreementApi.DocumentSeed = defaultBody
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/consumer-documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(apiResponse);
      expect(res.status).toBe(200);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
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
    { error: agreementNotFound(mockAgreement.id), expectedStatus: 404 },
    { error: tenantIsNotTheConsumer(generateId()), expectedStatus: 403 },
    {
      error: tenantIsNotTheDelegateConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
    { error: tenantNotAllowed(generateId()), expectedStatus: 403 },
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
    { agreementId: "invalid" as AgreementId },
    { body: {} },
    { body: { ...defaultBody, id: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ agreementId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        agreementId,
        body as agreementApi.DocumentSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
