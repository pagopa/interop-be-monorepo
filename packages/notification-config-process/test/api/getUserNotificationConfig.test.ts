import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { UserNotificationConfig, generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockTokenOrganizationId,
  mockTokenUserId,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { api, notificationConfigService } from "../vitest.api.setup.js";
import { userNotificationConfigToApiUserNotificationConfig } from "../../src/model/domain/apiConverter.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";
import { expectedUserIdAndOrganizationId } from "../utils.js";

describe("API GET /userNotificationConfigs test", () => {
  const userId = mockTokenUserId;
  const tenantId = mockTokenOrganizationId;
  const serviceResponse: UserNotificationConfig = {
    id: generateId(),
    userId,
    tenantId,
    inAppConfig: { newEServiceVersionPublished: true },
    emailConfig: { newEServiceVersionPublished: false },
    createdAt: generateMock(z.coerce.date()),
    updatedAt: generateMock(z.coerce.date().optional()),
  };
  const apiResponse: notificationConfigApi.UserNotificationConfig =
    userNotificationConfigToApiUserNotificationConfig(serviceResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get("/userNotificationConfigs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  beforeEach(() => {
    notificationConfigService.getUserNotificationConfig = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
      expect(
        notificationConfigService.getUserNotificationConfig
      ).toHaveBeenCalledWith(expectedUserIdAndOrganizationId(userId, tenantId));
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
    expect(
      notificationConfigService.getUserNotificationConfig
    ).not.toHaveBeenCalled();
  });

  it("Should return 404 for userNotificationConfigNotFound", async () => {
    notificationConfigService.getUserNotificationConfig = vi
      .fn()
      .mockRejectedValue(userNotificationConfigNotFound(userId, tenantId));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
    expect(
      notificationConfigService.getUserNotificationConfig
    ).toHaveBeenCalledWith(expectedUserIdAndOrganizationId(userId, tenantId));
  });
});
