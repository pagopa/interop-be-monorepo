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
    agreementId: string = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/consumer-documents`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(getMockDocumentSeed(mockConsumerDocument));

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

  it("Should return 404 for agreementNotFound", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(agreementNotFound(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(generateId(), undefined)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationNotAllowed", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(organizationNotAllowed(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for documentsChangeNotAllowed", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(documentsChangeNotAllowed(agreementState.active));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for agreementDocumentAlreadyExists", async () => {
    agreementService.addConsumerDocument = vi
      .fn()
      .mockRejectedValue(agreementDocumentAlreadyExists(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
