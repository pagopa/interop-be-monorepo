import { describe, expect, it, vi } from "vitest";
import {
  authRole,
  genericLogger,
  notificationAdmittedRoles,
} from "pagopa-interop-commons";
import { TenantId, UserId, UserRole, generateId } from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";

describe("getNotificationRecipients", () => {
  vi.unmock("../src/handlers/handlerCommons.js");

  const tenants: TenantId[] = [generateId<TenantId>(), generateId<TenantId>()];

  const users: Array<{
    userId: UserId;
    tenantId: TenantId;
    userRoles: UserRole[];
  }> = [
    {
      userId: generateId(),
      tenantId: tenants[0],
      userRoles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0],
      userRoles: [authRole.API_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0],
      userRoles: [authRole.SECURITY_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1],
      userRoles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1],
      userRoles: [authRole.API_ROLE, authRole.SECURITY_ROLE],
    },
    {
      // To test that SUPPORT users do not get notifications
      userId: generateId(),
      tenantId: tenants[1],
      userRoles: [authRole.SUPPORT_ROLE],
    },
  ];

  const readModelService = {
    getTenantUsersWithNotificationEnabled: vi.fn().mockResolvedValue(users),
  } as unknown as ReadModelServiceSQL;

  it("should call ReadModelServiceSQL.getTenantUsersWithNotificationEnabled", async () => {
    await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      genericLogger
    );
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(tenants, "agreementActivatedRejectedToConsumer");
  });

  it("should not return users with 'support' role", async () => {
    const result = await getNotificationRecipients(
      tenants,
      "agreementActivatedRejectedToConsumer",
      readModelService,
      genericLogger
    );
    expect(result).not.toContainEqual(users[5]);
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
      genericLogger
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([0, 3].map((i) => users[i])));
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
      genericLogger
    );
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([0, 1, 3, 4].map((i) => users[i]))
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
      genericLogger
    );
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([0, 2, 3, 4].map((i) => users[i]))
    );
  });
});
