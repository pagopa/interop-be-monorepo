/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { delegationNotFound } from "../../../src/model/errors.js";
import { getMockBffApiDelegation } from "../../mockUtils.js";

describe("API GET /delegations/:delegationId", () => {
  const mockDelegation = getMockBffApiDelegation();

  beforeEach(() => {
    services.delegationService.getDelegation = vi
      .fn()
      .mockResolvedValue(mockDelegation);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = mockDelegation.id
  ) =>
    request(api)
      .get(`${appBasePath}/delegations/${delegationId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockDelegation);
  });

  it("Should return 404 for delegationNotFound", async () => {
    services.delegationService.getDelegation = vi
      .fn()
      .mockRejectedValue(delegationNotFound(generateId()));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as DelegationId);
    expect(res.status).toBe(400);
  });
});
