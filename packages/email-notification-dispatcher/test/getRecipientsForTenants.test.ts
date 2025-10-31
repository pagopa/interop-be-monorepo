import { describe, expect, it, vi } from "vitest";
import {
  authRole,
  genericLogger,
  notificationAdmittedRoles,
} from "pagopa-interop-commons";
import { getMockTenant, getMockTenantMail } from "pagopa-interop-commons-test";
import {
  Tenant,
  TenantId,
  UserId,
  UserRole,
  generateId,
} from "pagopa-interop-models";
import { getRecipientsForTenants } from "../src/handlers/handlerCommons.js";
import { ReadModelServiceSQL } from "../src/services/readModelServiceSQL.js";

describe("getRecipientsForTenants", () => {
  const tenants: Tenant[] = [
    {
      // Tenant with contact mail and with notifications enabled
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    },
    {
      // Tenant with contact mail but with notifications disabled
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    },
    {
      // Tenant with contact mail but without a notification config
      ...getMockTenant(),
      mails: [getMockTenantMail()],
    },
    // Tenant without contact mail, included to test that no error is thrown
    getMockTenant(),
  ];

  const users: Array<{
    userId: UserId;
    tenantId: TenantId;
    userRoles: UserRole[];
  }> = [
    {
      userId: generateId(),
      tenantId: tenants[0].id,
      userRoles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0].id,
      userRoles: [authRole.API_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[0].id,
      userRoles: [authRole.SECURITY_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1].id,
      userRoles: [authRole.ADMIN_ROLE],
    },
    {
      userId: generateId(),
      tenantId: tenants[1].id,
      userRoles: [authRole.API_ROLE, authRole.SECURITY_ROLE],
    },
    {
      // To test that SUPPORT users do not get notifications
      userId: generateId(),
      tenantId: tenants[1].id,
      userRoles: [authRole.SUPPORT_ROLE],
    },
  ];

  const tenantRecipients = tenants.map((t) => ({
    type: "Tenant" as const,
    tenantId: t.id,
    address: t.mails[0]?.address,
  }));

  const userRecipients = users.map((u) => ({
    type: "User" as const,
    userId: u.userId,
    tenantId: u.tenantId,
  }));

  const readModelService = {
    getTenantUsersWithNotificationEnabled: vi.fn().mockResolvedValue(users),
    getTenantNotificationConfigByTenantId: vi
      .fn()
      .mockImplementation((tenantId) => {
        const tenant = tenants.find((t) => t.id === tenantId);
        if (!tenant || tenantId === tenants[2].id) {
          // tenants[2] has no notification config
          return undefined;
        }
        return {
          id: generateId(),
          tenantId: tenant.id,
          enabled: tenantId !== tenants[1].id, // tenants[1] has notifications disabled
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
  } as unknown as ReadModelServiceSQL;

  it("should call ReadModelServiceSQL.getTenantUsersWithNotificationEnabled", async () => {
    await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(
      tenants.map((tenant) => tenant.id),
      "agreementActivatedRejectedToConsumer"
    );
  });

  it("should not return users with 'support' role", async () => {
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).not.toContainEqual(userRecipients[5]);
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
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementSuspendedUnsuspendedToProducer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([userRecipients[0], userRecipients[3]])
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
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "templateStatusChangedToProducer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        userRecipients[0],
        userRecipients[1],
        userRecipients[3],
        userRecipients[4],
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
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "eserviceStateChangedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        userRecipients[0],
        userRecipients[2],
        userRecipients[3],
        userRecipients[4],
      ])
    );
  });

  it("should not return tenant contact emails if `includeTenantContactEmails` is false", async () => {
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).not.toContainEqual(
      expect.objectContaining({ type: "Tenant" })
    );
  });

  it("should return tenant contact emails if `includeTenantContactEmails` is true and the tenant has notifications enabled", async () => {
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: true,
      readModelService,
      logger: genericLogger,
    });
    expect(result).toContainEqual(tenantRecipients[0]);
  });

  it("should not return the tenant contact email if `includeTenantContactEmails` is true but the tenant has notifications disabled", async () => {
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).not.toContainEqual(tenantRecipients[1]);
  });

  it("should not return the tenant contact email if `includeTenantContactEmails` is true but the tenant has no notification config", async () => {
    const result = await getRecipientsForTenants({
      tenants,
      notificationType: "agreementActivatedRejectedToConsumer",
      includeTenantContactEmails: false,
      readModelService,
      logger: genericLogger,
    });
    expect(result).not.toContainEqual(tenantRecipients[2]);
  });
});
