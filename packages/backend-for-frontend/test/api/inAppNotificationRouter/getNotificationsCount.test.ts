/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockInAppNotificationApiNotificationsByType } from "../../mockUtils.js";

describe("API GET /inAppNotifications/count", () => {
  const mockNotificationsByType =
    getMockInAppNotificationApiNotificationsByType();

  beforeEach(() => {
    services.inAppNotificationService.getNotificationsByType = vi
      .fn()
      .mockResolvedValue(mockNotificationsByType);
  });

  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/inAppNotifications/count`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    // The response body will be the converted NotificationsCountBySection
    expect(res.body).toBeDefined();
  });
});
