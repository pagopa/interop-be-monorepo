/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Purpose, generateId } from "pagopa-interop-models";
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
  duplicatedPurposeTitle,
  purposeCannotBeCloned,
  purposeNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/clone test", () => {
  const mockEService = getMockEService();
  const mockPurposeCloneSeed = { eserviceId: mockEService.id };
  const mockPurpose: Purpose = getMockPurpose();
  const isRiskAnalysisValid = true;

  const apiResponse = purposeApi.Purpose.parse(
    purposeToApiPurpose(mockPurpose, isRiskAnalysisValid)
  );

  beforeEach(() => {
    purposeService.clonePurpose = vi
      .fn()
      .mockResolvedValue({ purpose: mockPurpose, isRiskAnalysisValid });
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/clone`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockPurposeCloneSeed);

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

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.clonePurpose = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 409 for duplicatedPurposeTitle", async () => {
    purposeService.clonePurpose = vi
      .fn()
      .mockRejectedValue(duplicatedPurposeTitle(mockPurpose.title));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 409 for purposeCannotBeCloned", async () => {
    purposeService.clonePurpose = vi
      .fn()
      .mockRejectedValue(purposeCannotBeCloned(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(409);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
