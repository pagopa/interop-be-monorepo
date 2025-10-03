import { describe, expect, it, vi } from "vitest";
import {
  authRole,
  genericLogger,
  notificationAdmittedRoles,
} from "pagopa-interop-commons";
import { TenantId, UserId, UserRole, generateId } from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";
import { UserServiceSQL } from "../src/services/userServiceSQL.js";

describe("getNotificationRecipients", () => {
  vi.unmock("../src/handlers/handlerCommons.js");

  const tenants: TenantId[] = [generateId<TenantId>(), generateId<TenantId>()];

  const users: Array<{
    userId: UserId;
    tenantId: TenantId;
    roles: UserRole[];
  }> = [
    {
      userId: generateId(),
      tenantId: tenants[0],
      roles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0],
      roles: [authRole.API_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0],
      roles: [authRole.SECURITY_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1],
      roles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1],
      roles: [authRole.API_ROLE, authRole.SECURITY_ROLE],
    },
    {
      // To test that SUPPORT users do not get notifications
      userId: generateId(),
      tenantId: tenants[1],
      roles: [authRole.SUPPORT_ROLE],
    },
    {
      // This user is not returned by the readUsers mock, so it should be excluded
      userId: generateId(),
      tenantId: tenants[1],
      roles: [authRole.ADMIN_ROLE],
    },
  ];

  const readModelService = {
    getTenantUsersWithNotificationEnabled: vi
      .fn()
      .mockResolvedValue(
        users.map(({ userId, tenantId }) => ({ userId, tenantId }))
      ),
  } as unknown as ReadModelServiceSQL;
  const userService = {
    readUsers: vi
      .fn()
      .mockResolvedValue(
        users.slice(0, -1).map(({ userId, roles }) => ({ userId, roles }))
      ),
  } as UserServiceSQL;

  it("should call ReadModelServiceSQL.getTenantUsersWithNotificationEnabled", async () => {
    await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      userService,
      genericLogger
    );
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(tenants, "agreementActivatedRejectedToConsumer");
  });

  it("should call UserServiceSQL.readUsers", async () => {
    await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      userService,
      genericLogger
    );
    expect(userService.readUsers).toHaveBeenCalledWith(
      users.map((u) => u.userId)
    );
  });

  it("should filter out users that are not returned by UserServiceSQL.readUsers", async () => {
    const result = await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      userService,
      genericLogger
    );
    expect(result).not.toContainEqual({
      userId: users[6].userId,
      tenantId: users[6].tenantId,
    });
  });

  it("should not return users with 'support' role", async () => {
    const result = await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      userService,
      genericLogger
    );
    expect(result).not.toContainEqual({
      userId: users[5].userId,
      tenantId: users[5].tenantId,
    });
  });

  it("should return the expected users for an 'admin'-only notification type", async () => {
    // For safety in case the admitted roles change in the future
    expect(
      notificationAdmittedRoles.agreementSuspendedUnsuspendedToProducer
    ).toEqual({
      [authRole.ADMIN_ROLE]: true,
      [authRole.API_ROLE]: false,
      [authRole.SECURITY_ROLE]: false,
      [authRole.SUPPORT_ROLE]: false,
    });
    const result = await getNotificationRecipients(
      tenants,
      "agreementSuspendedUnsuspendedToProducer",
      readModelService,
      userService,
      genericLogger
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          userId: users[0].userId,
          tenantId: users[0].tenantId,
        },
        {
          userId: users[3].userId,
          tenantId: users[3].tenantId,
        },
      ])
    );
  });

  it("should return the expected users for an 'admin' or 'api' notification type", async () => {
    // For safety in case the admitted roles change in the future
    expect(notificationAdmittedRoles.templateStatusChangedToProducer).toEqual({
      [authRole.ADMIN_ROLE]: true,
      [authRole.API_ROLE]: true,
      [authRole.SECURITY_ROLE]: false,
      [authRole.SUPPORT_ROLE]: false,
    });
    const result = await getNotificationRecipients(
      tenants,
      "templateStatusChangedToProducer",
      readModelService,
      userService,
      genericLogger
    );
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          userId: users[0].userId,
          tenantId: users[0].tenantId,
        },
        {
          userId: users[1].userId,
          tenantId: users[1].tenantId,
        },
        {
          userId: users[3].userId,
          tenantId: users[3].tenantId,
        },
        {
          userId: users[4].userId,
          tenantId: users[4].tenantId,
        },
      ])
    );
  });

  it("should return the expected users for an 'admin' or 'security' notification type", async () => {
    // For safety in case the admitted roles change in the future
    expect(notificationAdmittedRoles.eserviceStateChangedToConsumer).toEqual({
      [authRole.ADMIN_ROLE]: true,
      [authRole.API_ROLE]: false,
      [authRole.SECURITY_ROLE]: true,
      [authRole.SUPPORT_ROLE]: false,
    });
    const result = await getNotificationRecipients(
      tenants,
      "eserviceStateChangedToConsumer",
      readModelService,
      userService,
      genericLogger
    );
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        {
          userId: users[0].userId,
          tenantId: users[0].tenantId,
        },
        {
          userId: users[2].userId,
          tenantId: users[2].tenantId,
        },
        {
          userId: users[3].userId,
          tenantId: users[3].tenantId,
        },
        {
          userId: users[4].userId,
          tenantId: users[4].tenantId,
        },
      ])
    );
  });
});
