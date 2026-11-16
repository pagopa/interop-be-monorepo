/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /purposes/{purposeId}/remainingDailyCalls test", () => {
  const purposeId: PurposeId = generateId();
  const apiResponse = bffApi.RemainingDailyCallsResponse.parse({
    remainingDailyCallsPerConsumer: 80,
    remainingDailyCallsTotal: 1800,
  });

  beforeEach(() => {
    services.purposeService.getRemainingDailyCalls = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (token: string, purposeId: PurposeId) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/remainingDailyCalls`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, purposeId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeId);
    expect(res.status).toBe(400);
  });
});
