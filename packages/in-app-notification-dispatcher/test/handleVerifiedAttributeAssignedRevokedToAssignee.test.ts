/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockTenant,
  getMockAttribute,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  toTenantV2,
  AttributeId,
  Tenant,
  Attribute,
  attributeKind,
  TenantAttribute,
  TenantId,
} from "pagopa-interop-models";
import {
  attributeNotFound,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handleVerifiedAttributeAssignedRevokedToAssignee } from "../src/handlers/tenants/handleVerifiedAttributeAssignedRevokedToAssignee.js";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleVerifiedAttributeAssignedRevokedToAssignee", () => {
  const certifierId = generateId();

  const assignee = getMockTenant();
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
    features: [{ type: "PersistentCertifier", certifierId }],
  };
  const verifier: Tenant = {
    ...getMockTenant(),
    name: "Verifier Name",
  };
  const revoker: Tenant = {
    ...getMockTenant(),
    name: "Revoker Name",
  };

  const verifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.verified),
    name: "Verified Attribute",
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneTenant(assignee);
    await addOneTenant(certifier);
    await addOneTenant(verifier);
    await addOneTenant(revoker);
    await addOneAttribute(verifiedAttribute);
  });

  // Certified Attribute
  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleVerifiedAttributeAssignedRevokedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService,
        "TenantVerifiedAttributeAssigned"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantVerifiedAttributeAssigned")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService,
        "TenantVerifiedAttributeAssigned"
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw verifiedAttributeNotFoundInTenant when the verified attribute is not found", async () => {
    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2({ ...assignee, attributes: [] }),
        verifiedAttribute.id,
        logger,
        readModelService,
        "TenantVerifiedAttributeAssigned"
      )
    ).rejects.toThrow(
      verifiedAttributeNotFoundInTenant(assignee.id, verifiedAttribute.id)
    );
  });

  it("should throw tenantNotFound when the verifier is not found", async () => {
    const unknownVerifierId = generateId<TenantId>();

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2({
          ...assignee,
          attributes: [
            {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              verifiedBy: [
                { id: unknownVerifierId, verificationDate: new Date() },
              ],
            },
          ],
        }),
        verifiedAttribute.id,
        logger,
        readModelService,
        "TenantVerifiedAttributeAssigned"
      )
    ).rejects.toThrow(tenantNotFound(unknownVerifierId));
  });

  it.each<{
    eventType:
      | "TenantVerifiedAttributeAssigned"
      | "TenantVerifiedAttributeRevoked";
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantVerifiedAttributeAssigned",
      attributeId: verifiedAttribute.id,
    },
    {
      eventType: "TenantVerifiedAttributeRevoked",
      attributeId: verifiedAttribute.id,
    },
  ])(
    "should return empty array when no users have notifications enabled for event $eventType",
    async ({ eventType, attributeId }) => {
      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications =
        await handleVerifiedAttributeAssignedRevokedToAssignee(
          toTenantV2(assignee),
          attributeId,
          logger,
          readModelService,
          eventType
        );

      expect(notifications).toEqual([]);
    }
  );

  it.each<{
    eventType:
      | "TenantVerifiedAttributeAssigned"
      | "TenantVerifiedAttributeRevoked";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
    expectedBody: string;
  }>([
    {
      eventType: "TenantVerifiedAttributeAssigned",
      assigneeAttributes: [
        {
          ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
          verifiedBy: [
            { id: verifier.id, verificationDate: new Date() },
            {
              // older verifiedBy to be ignored
              id: certifier.id,
              verificationDate: new Date(Date.now() - 10000),
            },
          ],
        },
      ],
      attributeId: verifiedAttribute.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        verifiedAttribute.name,
        "verificato",
        "Verifier Name"
      ),
    },
    {
      eventType: "TenantVerifiedAttributeRevoked",
      assigneeAttributes: [
        {
          ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
          revokedBy: [
            {
              id: revoker.id,
              verificationDate: new Date(Date.now() - 10000),
              revocationDate: new Date(),
            },
            {
              // older revokedBy to be ignored
              id: certifier.id,
              verificationDate: new Date(Date.now() - 20000),
              revocationDate: new Date(Date.now() - 10000),
            },
          ],
        },
      ],
      attributeId: verifiedAttribute.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        verifiedAttribute.name,
        "verificato",
        "Revoker Name"
      ),
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, assigneeAttributes, attributeId, expectedBody }) => {
      const assigneeUsers = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];

      mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

      const notifications =
        await handleVerifiedAttributeAssignedRevokedToAssignee(
          toTenantV2({ ...assignee, attributes: assigneeAttributes }),
          attributeId,
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
        entityId: attributeId,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it.each<{
    eventType:
      | "TenantVerifiedAttributeAssigned"
      | "TenantVerifiedAttributeRevoked";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantVerifiedAttributeAssigned",
      assigneeAttributes: [
        {
          ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
          verifiedBy: [
            { id: verifier.id, verificationDate: new Date() },
            {
              // older verifiedBy to be ignored
              id: certifier.id,
              verificationDate: new Date(Date.now() - 10000),
            },
          ],
        },
      ],
      attributeId: verifiedAttribute.id,
    },
    {
      eventType: "TenantVerifiedAttributeRevoked",
      assigneeAttributes: [
        {
          ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
          revokedBy: [
            {
              id: revoker.id,
              verificationDate: new Date(Date.now() - 10000),
              revocationDate: new Date(),
            },
            {
              // older revokedBy to be ignored
              id: certifier.id,
              verificationDate: new Date(Date.now() - 20000),
              revocationDate: new Date(Date.now() - 10000),
            },
          ],
        },
      ],
      attributeId: verifiedAttribute.id,
    },
  ])(
    "should generate notifications for multiple users for event $eventType",
    async ({ eventType, assigneeAttributes, attributeId }) => {
      const users = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications =
        await handleVerifiedAttributeAssignedRevokedToAssignee(
          toTenantV2({ ...assignee, attributes: assigneeAttributes }),
          attributeId,
          logger,
          readModelService,
          eventType
        );

      expect(notifications).toHaveLength(3);

      // Check that all users got notifications
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(users[0].userId);
      expect(userIds).toContain(users[1].userId);
      expect(userIds).toContain(users[2].userId);
    }
  );
});
