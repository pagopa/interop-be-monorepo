/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, Mock } from "vitest";
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
  Tenant,
  Attribute,
  attributeKind,
  TenantAttribute,
} from "pagopa-interop-models";
import { handleCertifiedAttributeAssignedRevokedToAssignee } from "../src/handlers/tenants/handleCertifiedAttributeAssignedRevokedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
} from "../src/models/errors.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedAttributeAssignedRevokedToAssignee", () => {
  const certifierId = generateId();

  const assignee = getMockTenant();
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
    features: [{ type: "PersistentCertifier", certifierId }],
  };
  const revoker: Tenant = {
    ...getMockTenant(),
    name: "Revoker Name",
  };

  const certifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified Attribute",
    origin: certifierId,
  };
  const certifiedAttributeANAC: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified ANAC Attribute",
    origin: "ANAC",
  };
  const certifiedAttributeIPA: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified IPA Attribute",
    origin: "IPA",
  };
  const certifiedAttributeIVASS: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified IVASS Attribute",
    origin: "IVASS",
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneTenant(assignee);
    await addOneTenant(certifier);
    await addOneTenant(revoker);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedAttributeANAC);
    await addOneAttribute(certifiedAttributeIPA);
    await addOneAttribute(certifiedAttributeIVASS);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedAttributeAssignedRevokedToAssignee(
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

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw attributeOriginUndefined when the certified attribute has undefined origin", async () => {
    const certifiedAttributeWithUndefinedOrigin: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: undefined,
    };
    await addOneAttribute(certifiedAttributeWithUndefinedOrigin);

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUndefinedOrigin.id,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(
      attributeOriginUndefined(certifiedAttributeWithUndefinedOrigin.id)
    );
  });

  it("should throw certifierTenantNotFound when the certifier tenant is not found", async () => {
    const unknownCertifierId = generateId();
    const certifiedAttributeWithUnknownCertifier: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: unknownCertifierId,
    };
    await addOneAttribute(certifiedAttributeWithUnknownCertifier);

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    const tenant = toTenantV2(assignee);

    await expect(() =>
      handleCertifiedAttributeAssignedRevokedToAssignee(
        tenant,
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it.each<{
    eventType:
      | "TenantCertifiedAttributeAssigned"
      | "TenantCertifiedAttributeRevoked";
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantCertifiedAttributeAssigned",
      attributeId: certifiedAttribute.id,
    },
    {
      eventType: "TenantCertifiedAttributeRevoked",
      attributeId: certifiedAttribute.id,
    },
  ])(
    "should return empty array when no users have notifications enabled for event $eventType",
    async ({ eventType, attributeId }) => {
      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications =
        await handleCertifiedAttributeAssignedRevokedToAssignee(
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
      | "TenantCertifiedAttributeAssigned"
      | "TenantCertifiedAttributeRevoked";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
    expectedBody: string;
  }>([
    {
      eventType: "TenantCertifiedAttributeAssigned",
      assigneeAttributes: [],
      attributeId: certifiedAttribute.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttribute.name,
        "certificato",
        "Certifier Name"
      ),
    },
    {
      eventType: "TenantCertifiedAttributeAssigned",
      assigneeAttributes: [],
      attributeId: certifiedAttributeANAC.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttributeANAC.name,
        "certificato",
        "ANAC"
      ),
    },
    {
      eventType: "TenantCertifiedAttributeRevoked",
      assigneeAttributes: [],
      attributeId: certifiedAttributeIPA.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        certifiedAttributeIPA.name,
        "certificato",
        "IPA"
      ),
    },
    {
      eventType: "TenantCertifiedAttributeRevoked",
      assigneeAttributes: [],
      attributeId: certifiedAttributeIVASS.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        certifiedAttributeIVASS.name,
        "certificato",
        "IVASS"
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
        await handleCertifiedAttributeAssignedRevokedToAssignee(
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
      | "TenantCertifiedAttributeAssigned"
      | "TenantCertifiedAttributeRevoked";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantCertifiedAttributeAssigned",
      assigneeAttributes: [],
      attributeId: certifiedAttribute.id,
    },
    {
      eventType: "TenantCertifiedAttributeRevoked",
      assigneeAttributes: [],
      attributeId: certifiedAttributeIPA.id,
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
        await handleCertifiedAttributeAssignedRevokedToAssignee(
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
