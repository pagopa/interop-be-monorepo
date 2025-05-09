/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { generateToken, getMockAgreement } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { agreementApi } from "pagopa-interop-api-clients";
import { api, agreementService } from "../vitest.api.setup.js";
import { agreementToApiAgreement } from "../../src/model/domain/apiConverter.js";
import {
  agreementActivationFailed,
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotInExpectedState,
  notLatestEServiceDescriptor,
  organizationIsNotTheDelegateProducer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements/{agreementId}/activate test", () => {
  const mockAgreement = getMockAgreement();

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.activateAgreement = vi
      .fn()
      .mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/activate`)
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

  it("Should return 400 for notLatestEServiceDescriptor", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(notLatestEServiceDescriptor(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for agreementNotInExpectedState", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(
        agreementNotInExpectedState(mockAgreement.id, agreementState.draft)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for agreementActivationFailed", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(agreementActivationFailed(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for descriptorNotInExpectedState", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(
        descriptorNotInExpectedState(generateId(), generateId(), [])
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 404 for agreementNotFound", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotFound(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 403 for organizationIsNotTheDelegateProducer", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegateProducer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheProducer", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheProducer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationNotAllowed", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(organizationNotAllowed(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 409 for agreementAlreadyExists", async () => {
    agreementService.activateAgreement = vi
      .fn()
      .mockRejectedValue(agreementAlreadyExists(generateId(), generateId()));
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
