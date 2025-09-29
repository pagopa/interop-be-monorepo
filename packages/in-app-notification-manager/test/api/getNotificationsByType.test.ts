/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, inAppNotificationService } from "../vitest.api.setup.js";

describe("API GET /notifications/byType", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .get("/notifications/byType")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  beforeEach(() => {
    vi.clearAllMocks();
    inAppNotificationService.getNotificationsByType = vi
      .fn()
      .mockResolvedValue({
        results: {
          agreementSuspendedUnsuspendedToProducer: 5,
          agreementManagementToProducer: 3,
          clientAddedRemovedToProducer: 2,
        },
        totalCount: 10,
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
    "Should return 200 with notifications by type for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        results: expect.any(Object),
        totalCount: 10,
      });
      expect(res.body.results).toHaveProperty(
        "agreementSuspendedUnsuspendedToProducer",
        5
      );
      expect(res.body.results).toHaveProperty(
        "agreementManagementToProducer",
        3
      );
      expect(res.body.results).toHaveProperty(
        "clientAddedRemovedToProducer",
        2
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should call the service method with correct context", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);

    await makeRequest(token);

    expect(
      inAppNotificationService.getNotificationsByType
    ).toHaveBeenCalledWith(expect.any(Object));
  });

  it("Should return empty results when no notifications exist", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    inAppNotificationService.getNotificationsByType = vi
      .fn()
      .mockResolvedValue({
        results: {},
        totalCount: 0,
      });

    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      results: {},
      totalCount: 0,
    });
  });

  it("Should handle service errors gracefully", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    inAppNotificationService.getNotificationsByType = vi
      .fn()
      .mockRejectedValue(new Error("Database connection failed"));

    const res = await makeRequest(token);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
