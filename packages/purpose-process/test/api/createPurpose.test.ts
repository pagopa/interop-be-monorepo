/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, Purpose, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEService,
  getMockPurpose,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeToApiPurpose } from "../../src/model/domain/apiConverter.js";
import {
  agreementNotFound,
  duplicatedPurposeTitle,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  riskAnalysisValidationFailed,
} from "../../src/model/domain/errors.js";
import { getMockPurposeSeed } from "../mockUtils.js";

describe("API POST /purposes test", () => {
  const mockEService = getMockEService();
  const mockPurposeSeed = getMockPurposeSeed(mockEService.id);
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, isRiskAnalysisValid)
  );

  beforeEach(() => {
    purposeService.createPurpose = vi
      .fn()
      .mockResolvedValue({ purpose: mockPurpose, isRiskAnalysisValid });
  });

  const makeRequest = async (token: string, data: object = mockPurposeSeed) =>
    request(api)
      .post("/purposes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(data);

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

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegatedConsumer", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegatedConsumer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for missingFreeOfChargeReason", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(missingFreeOfChargeReason());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for agreementNotFound", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(agreementNotFound(generateId(), generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 400 for riskAnalysisValidationFailed", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(riskAnalysisValidationFailed([]));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 409 for duplicatedPurposeTitle", async () => {
    purposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(duplicatedPurposeTitle(mockPurposeSeed.title));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid purpose seed", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      eserviceId: mockEService.id,
      title: "test",
      dailyCalls: 10,
      description: "test",
      isFreeOfCharge: true,
      freeOfChargeReason: "reason",
    });
    expect(res.status).toBe(400);
  });
});
