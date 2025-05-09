/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { agreementState, generateId } from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  missingCertifiedAttributesError,
  noNewerDescriptor,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegateConsumer,
  publishedDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";

describe("API POST /agreements/{agreementId}/upgrade test", () => {
  const mockAgreement = getMockAgreement();

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/upgrade`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.ADMIN_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for agreementNotFound", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotFound(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for missingCertifiedAttributesError", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(
        missingCertifiedAttributesError(
          mockAgreement.descriptorId,
          mockAgreement.consumerId
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for agreementNotInExpectedState", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(
        agreementNotInExpectedState(mockAgreement.id, agreementState.active)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for publishedDescriptorNotFound", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(publishedDescriptorNotFound(mockAgreement.eserviceId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for noNewerDescriptor", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(
        noNewerDescriptor(mockAgreement.eserviceId, mockAgreement.descriptorId)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateConsumer", async () => {
    agreementService.upgradeAgreement = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateConsumer(generateId(), undefined)
      );
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
