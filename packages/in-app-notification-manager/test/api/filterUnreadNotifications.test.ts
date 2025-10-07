/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, inAppNotificationService } from "../vitest.api.setup.js";

describe("API GET /filterUnreadNotifications", () => {
  const entityIdsArray: string[] = [generateId(), generateId(), generateId()];
  const makeRequest = async (token: string, entityIds: string[]) =>
    request(api)
      .get("/filterUnreadNotifications")
      .query({ entityIds })
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    vi.clearAllMocks();
    inAppNotificationService.hasUnreadNotification = vi
      .fn()
      .mockResolvedValue(entityIdsArray);
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
    "Should return 200 with hasUnreadNotification for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, entityIdsArray);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
      expect(
        inAppNotificationService.hasUnreadNotification
      ).toHaveBeenCalledTimes(1);
    }
  );
  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, entityIdsArray);
    expect(res.status).toBe(403);
  });
  it("Should pass entityIds parameters to the service", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    await makeRequest(token, entityIdsArray);

    expect(inAppNotificationService.hasUnreadNotification).toHaveBeenCalledWith(
      entityIdsArray,
      expect.any(Object)
    );
  });
  it("Should return empty array when no unread notifications exist", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    inAppNotificationService.hasUnreadNotification = vi
      .fn()
      .mockResolvedValue([]);

    const res = await makeRequest(token, entityIdsArray);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
  it("Should return a 4xx error if the input is malformed or empty", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const malformedResponse = await request(api)
      .get("/filterUnreadNotifications")
      .query([123, 456]) // not strings
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();
    expect(malformedResponse.status).toBe(400);

    const emptyResponse = await makeRequest(token, []);
    expect(emptyResponse.status).toBe(400);
  });
});
