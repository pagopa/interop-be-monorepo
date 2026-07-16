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
import { handleCertifiedAttributeAssignedToAssignee } from "../src/handlers/tenants/handleCertifiedAttributeAssignedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedAttributeAssignedToAssignee", () => {
  const certifierId = generateId();

  const assignee = getMockTenant();
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
    features: [{ type: "PersistentCertifier", certifierId }],
  };
  const anacCertifier: Tenant = {
    ...getMockTenant(),
    name: "ANAC Name",
    features: [{ type: "PersistentCertifier", certifierId: "ANAC" }],
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
  const certifiedAttributeSELFCARE: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified SELFCARE Attribute",
    origin: "SELFCARE",
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneTenant(assignee);
    await addOneTenant(certifier);
    await addOneTenant(anacCertifier);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedAttributeANAC);
    await addOneAttribute(certifiedAttributeIPA);
    await addOneAttribute(certifiedAttributeSELFCARE);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedAttributeAssignedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantCertifiedAttributeAssigned")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeAssignedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw attributeOriginUndefined when the certified attribute has undefined origin", async () => {
    const certifiedAttributeWithUndefinedOrigin: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: undefined,
    };
    await addOneAttribute(certifiedAttributeWithUndefinedOrigin);

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUndefinedOrigin.id,
        logger,
        readModelService
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

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleCertifiedAttributeAssignedToAssignee(
      toTenantV2(assignee),
      certifiedAttribute.id,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
    expectedBody: string;
  }>([
    {
      assigneeAttributes: [],
      attributeId: certifiedAttribute.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttribute.name,
        "certificato",
        "Certifier Name"
      ),
    },
    {
      assigneeAttributes: [],
      attributeId: certifiedAttributeANAC.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttributeANAC.name,
        "certificato",
        "ANAC Name"
      ),
    },
    {
      assigneeAttributes: [],
      attributeId: certifiedAttributeIPA.id,
      expectedBody:
        inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
          certifiedAttributeIPA.name
        ),
    },
    {
      assigneeAttributes: [],
      attributeId: certifiedAttributeSELFCARE.id,
      expectedBody:
        inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
          certifiedAttributeSELFCARE.name
        ),
    },
  ])(
    "should handle assigned event correctly",
    async ({ assigneeAttributes, attributeId, expectedBody }) => {
      const assigneeUsers = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];

      mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

      const notifications = await handleCertifiedAttributeAssignedToAssignee(
        toTenantV2({ ...assignee, attributes: assigneeAttributes }),
        attributeId,
        logger,
        readModelService
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

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleCertifiedAttributeAssignedToAssignee(
      toTenantV2(assignee),
      certifiedAttribute.id,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(3);

    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
