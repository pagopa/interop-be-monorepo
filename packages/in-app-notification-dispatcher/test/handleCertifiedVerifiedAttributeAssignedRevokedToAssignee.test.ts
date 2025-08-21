/* eslint-disable functional/immutable-data */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMockContext,
  getMockTenant,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  toTenantV2,
  AttributeId,
} from "pagopa-interop-models";
import { handleCertifiedVerifiedAttributeAssignedRevokedToAssignee } from "../src/handlers/tenants/handleCertifiedVerifiedAttributeAssignedRevokedToAssignee.js";
import { attributeNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedVerifiedAttributeAssignedRevokedToAssignee", () => {
  const assignee = getMockTenant();
  const attribute = getMockAttribute();

  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneTenant(assignee);
    await addOneAttribute(attribute);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantCertifiedAttributeAssigned")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    // Mock notification service to return users (so the check doesn't exit early)
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: assignee.id }]);

    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications =
      await handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        attribute.id,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "TenantCertifiedAttributeAssigned"
      | "TenantCertifiedAttributeRevoked"
      | "TenantVerifiedAttributeAssigned"
      | "TenantVerifiedAttributeRevoked";
    expectedBody: string;
  }>([
    {
      eventType: "TenantCertifiedAttributeAssigned",
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "certificato"
      ),
    },
    {
      eventType: "TenantCertifiedAttributeRevoked",
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "certificato"
      ),
    },
    {
      eventType: "TenantVerifiedAttributeAssigned",
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        attribute.name,
        "verificato"
      ),
    },
    {
      eventType: "TenantVerifiedAttributeRevoked",
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        attribute.name,
        "verificato"
      ),
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, expectedBody }) => {
      const assigneeUsers = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];

      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(assigneeUsers);

      const notifications =
        await handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
          toTenantV2(assignee),
          attribute.id,
          logger,
          readModelService,
          eventType
        );

      expect(notifications).toHaveLength(assigneeUsers.length);

      const expectedNotifications = assigneeUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
        entityId: attribute.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications =
      await handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        attribute.id,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
