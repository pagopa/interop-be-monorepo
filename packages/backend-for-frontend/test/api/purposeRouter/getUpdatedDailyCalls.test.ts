/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /purposes/{purposeId}/getUpdateDailyCalls test", () => {
  const purposeId: PurposeId = generateId();
  const apiResponse = bffApi.UpdatedDailyCallsResponse.parse({
    updatedDailyCallsPerConsumer: 80,
    updatedDailyCallsTotal: 1800,
  });

  beforeEach(() => {
    services.purposeService.getUpdatedDailyCalls = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (token: string, purposeId: PurposeId) =>
    request(api)
      .get(`${appBasePath}/purposes/${purposeId}/getUpdateDailyCalls`)
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
