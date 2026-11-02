/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { EServiceId, PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  purposeNotFound,
  eserviceNotFound,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";
import { api, purposeService } from "../vitest.api.setup.js";

describe("API POST /maintenance/purposes/{purposeId}/riskAnalysis/tenantKind/fix test", () => {
  const mockPurpose = getMockPurpose();
  const serviceResponse = getMockWithMetadata(mockPurpose);

  beforeEach(() => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id
  ) =>
    request(api)
      .post(`/maintenance/purposes/${purposeId}/riskAnalysis/tenantKind/fix`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for eserviceNotFound", async () => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(eserviceNotFound(generateId<EServiceId>()));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for tenantKindNotFound", async () => {
    purposeService.fixPurposeRiskAnalysisTenantKind = vi
      .fn()
      .mockRejectedValue(tenantKindNotFound(mockPurpose.consumerId));

    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed invalid purposeId", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });
});
