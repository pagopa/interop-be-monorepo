/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockInAppNotificationApiNotifications } from "../../mockUtils.js";

describe("API GET /inAppNotifications", () => {
  const defaultQuery = {
    offset: 0,
    limit: 50,
  };
  const mockNotifications = getMockInAppNotificationApiNotifications();

  beforeEach(() => {
    services.inAppNotificationService.getNotifications = vi
      .fn()
      .mockResolvedValue(mockNotifications);
  });

  const makeRequest = async (token: string, query: object = defaultQuery) =>
    request(api)
      .get(`${appBasePath}/inAppNotifications`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });

  it("Should return 200 with query parameter q", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, { ...defaultQuery, q: "test" });
    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });

  it.each([
    { query: {} },
    { query: { offset: 0 } },
    { query: { limit: 50 } },
    { query: { ...defaultQuery, offset: "invalid" } },
    { query: { ...defaultQuery, limit: "invalid" } },
  ])("Should return 400 if passed an invalid data: %s", async ({ query }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query);
    expect(res.status).toBe(400);
  });
});
