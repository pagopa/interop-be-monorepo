/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import {
  purposeNotFound,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import { remainingDailyCallsToApiRemainingDailyCalls } from "../../src/model/domain/apiConverter.js";

describe("API GET /purposes/{purposeId}/remainingDailyCalls test", () => {
  const purposeId: PurposeId = generateId();

  const apiResponse = purposeApi.RemainingDailyCallsResponse.parse(
    remainingDailyCallsToApiRemainingDailyCalls({
      remainingDailyCallsPerConsumer: 80,
      remainingDailyCallsTotal: 1800,
    })
  );

  beforeEach(() => {
    purposeService.getRemainingDailyCalls = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    params: { purposeId?: string } = {
      purposeId,
    }
  ) =>
    request(api)
      .get(`/purposes/${params.purposeId}/remainingDailyCalls`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, { purposeId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, { purposeId });
    expect(res.status).toBe(403);
  });

  it.each([{ purposeId: "invalid" }])(
    "Should return 400 if passed invalid data: %s",
    async (params) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, params);
      expect(res.status).toBe(400);
    }
  );

  it.each([
    {
      error: purposeNotFound(generateId()),
      expectedStatus: 404,
    },
    {
      error: tenantIsNotTheConsumer(generateId(), undefined),
      expectedStatus: 403,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getRemainingDailyCalls = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, { purposeId });
      expect(res.status).toBe(expectedStatus);
    }
  );
});
