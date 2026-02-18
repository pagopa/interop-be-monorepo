/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /purposes/updatedDailyCalls test", () => {
  const eserviceId: EServiceId = generateId();
  const descriptorId: DescriptorId = generateId();
  const apiResponse = bffApi.UpdatedDailyCallsResponse.parse({
    eserviceId,
    descriptorId,
    updatedDailyCallsPerConsumer: 80,
    updatedDailyCallsTotal: 1800,
  });

  beforeEach(() => {
    services.purposeService.getUpdatedDailyCalls = vi
      .fn()
      .mockResolvedValue(apiResponse);
  });

  const makeRequest = async (
    token: string,
    query: { eserviceId?: string; descriptorId?: string } = {
      eserviceId,
      descriptorId,
    }
  ) =>
    request(api)
      .get(`${appBasePath}/purposes/updatedDailyCalls`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each([
    { query: {} },
    { query: { eserviceId } },
    { query: { descriptorId } },
    { query: { eserviceId: "invalid", descriptorId } },
    { query: { eserviceId, descriptorId: "invalid" } },
  ])("Should return 400 if passed invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query);
    expect(res.status).toBe(400);
  });
});
