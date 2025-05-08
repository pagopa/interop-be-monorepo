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
import { api, purposeService } from "../vitest.api.setup.js";
import {
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheDelegatedConsumer,
  purposeNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API POST /internal/delegations/{delegationId}/purposes/{purposeId}/versions/{versionId}/archive test", () => {
  const mockPurposeVersion = getMockPurposeVersion();
  const mockPurpose = { ...getMockPurpose(), versions: [mockPurposeVersion] };

  beforeEach(() => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: string = generateId(),
    purposeId: string = mockPurpose.id,
    versionId: string = mockPurposeVersion.id
  ) =>
    request(api)
      .post(
        `/internal/delegations/${delegationId}/purposes/${purposeId}/versions/${versionId}/archive`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Internal", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each(
    Object.values(authRole).filter((role) => role !== authRole.INTERNAL_ROLE)
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for notValidVersionState", async () => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(
        notValidVersionState(mockPurposeVersion.id, purposeVersionState.draft)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(400);
  });

  it("Should return 403 for organizationIsNotTheConsumer", async () => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(organizationIsNotTheConsumer(generateId()));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 403 for organizationIsNotTheDelegatedConsumer", async () => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(
        organizationIsNotTheDelegatedConsumer(
          generateId(),
          generateId<DelegationId>()
        )
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 404 for purposeNotFound", async () => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(purposeNotFound(mockPurpose.id));
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 404 for purposeVersionNotFound", async () => {
    purposeService.internalArchivePurposeVersionAfterDelegationRevocation = vi
      .fn()
      .mockRejectedValue(
        purposeVersionNotFound(mockPurpose.id, mockPurposeVersion.id)
      );
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
