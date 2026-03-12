/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /inAppNotifications/:notificationId/markAsRead", () => {
  const notificationId = generateId();

  beforeEach(() => {
    services.inAppNotificationService.markNotificationAsRead = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (token: string, id: string = notificationId) =>
    request(api)
      .post(`${appBasePath}/inAppNotifications/${id}/markAsRead`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
  });

  it("Should return 400 if passed an invalid notification id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
