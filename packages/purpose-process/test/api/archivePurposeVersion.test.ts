/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeVersionToApiPurposeVersion } from "../../src/model/domain/apiConverter.js";
import {
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/archive test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };

  const apiResponse = purposeApi.PurposeVersion.parse(
    purposeVersionToApiPurposeVersion(mockPurposeVersion)
  );

  beforeEach(() => {
    purposeService.archivePurposeVersion = vi
      .fn()
      .mockResolvedValue(mockPurposeVersion);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurpose.id,
    versionId: string = mockPurposeVersion.id
  ) =>
    request(api)
      .post(`/purposes/${purposeId}/versions/${versionId}/archive`)
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

  it("Should return 400 for notValidVersionState", async () => {
    purposeService.archivePurposeVersion = vi
      .fn()
      .mockRejectedValue(
        notValidVersionState(mockPurposeVersion.id, purposeVersionState.draft)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    purposeService.archivePurposeVersion = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegatedConsumer", async () => {
    purposeService.archivePurposeVersion = vi
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

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.archivePurposeVersion = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for purposeVersionNotFound", async () => {
    purposeService.archivePurposeVersion = vi
      .fn()
      .mockRejectedValue(
        purposeVersionNotFound(mockPurpose.id, mockPurposeVersion.id)
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
