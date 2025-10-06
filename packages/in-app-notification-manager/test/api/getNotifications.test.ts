/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, inAppNotificationService } from "../vitest.api.setup.js";

describe("API GET /notifications", () => {
  const makeRequest = async (
    token: string,
    queryParams: Record<string, string> = {
      limit: "10",
      offset: "0",
    }
  ) =>
    request(api)
      .get("/notifications")
      .query(queryParams)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    vi.clearAllMocks();
    inAppNotificationService.getNotifications = vi.fn().mockResolvedValue({
      results: [
        {
          id: generateId(),
          userId: generateId(),
          tenantId: generateId(),
          body: "Notification 1",
          notificationType: "test",
          entityId: generateId(),
          readAt: new Date(),
          createdAt: new Date(),
        },
      ],
      totalCount: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 with notifications for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        results: expect.any(Array),
        totalCount: 1,
      });
      expect(res.body.results).toHaveLength(1);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should pass query parameters to the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const queryParams = {
      q: "search term",
      limit: "10",
      offset: "5",
    };

    await makeRequest(token, queryParams);

    expect(inAppNotificationService.getNotifications).toHaveBeenCalledWith(
      queryParams.q,
      [], // entityIds
      false, // unread
      Number(queryParams.limit),
      Number(queryParams.offset),
      expect.any(Object)
    );
  });

  it("Should return empty array when no notifications exist", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    inAppNotificationService.getNotifications = vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
    });

    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      results: [],
      totalCount: 0,
    });
  });
});
