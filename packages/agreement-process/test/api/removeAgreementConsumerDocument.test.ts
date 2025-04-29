/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementState, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementDocumentNotFound,
  documentsChangeNotAllowed,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
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
    agreementId: string = mockAgreement.id,
    documentId: string = mockConsumerDocument.id
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

  it("Should return 404 for documentNotFound", async () => {
    agreementService.removeAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(
        agreementDocumentNotFound(mockConsumerDocument.id, mockAgreement.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    agreementService.removeAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.removeAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(generateId(), undefined)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for documentsChangeNotAllowed", async () => {
    agreementService.removeAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(documentsChangeNotAllowed(agreementState.active));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
