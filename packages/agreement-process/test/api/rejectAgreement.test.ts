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
  agreementNotFound,
  agreementNotInExpectedState,
  organizationIsNotTheDelegateProducer,
  organizationIsNotTheProducer,
} from "../../src/model/domain/errors.js";

describe("API POST /agreements/{agreementId}/reject test", () => {
  const mockAgreement = getMockAgreement();

  const apiResponse = agreementApi.Agreement.parse(
    agreementToApiAgreement(mockAgreement)
  );

  beforeEach(() => {
    agreementService.rejectAgreement = vi.fn().mockResolvedValue(mockAgreement);
  });

  const makeRequest = async (
    token: string,
    agreementId: string = mockAgreement.id
  ) =>
    request(api)
      .post(`/agreements/${agreementId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ reason: "Mock reason for rejection" });

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
    agreementService.rejectAgreement = vi
      .fn()
      .mockRejectedValue(agreementNotFound(mockAgreement.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 for agreementNotInExpectedState", async () => {
    agreementService.rejectAgreement = vi
      .fn()
      .mockRejectedValue(
        agreementNotInExpectedState(mockAgreement.id, agreementState.draft)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheProducer", async () => {
    agreementService.rejectAgreement = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheProducer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegateProducer", async () => {
    agreementService.rejectAgreement = vi
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

  it("Should return 400 if passed an invalid agreement id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
