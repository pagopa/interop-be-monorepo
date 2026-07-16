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
import { handleCertifiedAttributeRevokedToAssignee } from "../src/handlers/tenants/handleCertifiedAttributeRevokedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedAttributeRevokedToAssignee", () => {
  const certifierId = generateId();

  const assignee = getMockTenant();
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
    features: [{ type: "PersistentCertifier", certifierId }],
  };
  const ivassCertifier: Tenant = {
    ...getMockTenant(),
    name: "IVASS Name",
    features: [{ type: "PersistentCertifier", certifierId: "IVASS" }],
  };

  const certifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified Attribute",
    origin: certifierId,
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
    await addOneTenant(ivassCertifier);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedAttributeIPA);
    await addOneAttribute(certifiedAttributeIVASS);
    await addOneAttribute(certifiedAttributeSELFCARE);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedAttributeRevokedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantCertifiedAttributeRevoked")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedAttributeRevokedToAssignee(
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
      handleCertifiedAttributeRevokedToAssignee(
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
      handleCertifiedAttributeRevokedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleCertifiedAttributeRevokedToAssignee(
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
      attributeId: certifiedAttributeIPA.id,
      expectedBody:
        inAppTemplates.certifiedAttributeRevokedToAssigneeFromImport(
          certifiedAttributeIPA.name
        ),
    },
    {
      assigneeAttributes: [],
      attributeId: certifiedAttributeSELFCARE.id,
      expectedBody:
        inAppTemplates.certifiedAttributeRevokedToAssigneeFromImport(
          certifiedAttributeSELFCARE.name
        ),
    },
    {
      assigneeAttributes: [],
      attributeId: certifiedAttributeIVASS.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        certifiedAttributeIVASS.name,
        "certificato",
        "IVASS Name"
      ),
    },
  ])(
    "should handle revoked event correctly",
    async ({ assigneeAttributes, attributeId, expectedBody }) => {
      const assigneeUsers = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];

      mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

      const notifications = await handleCertifiedAttributeRevokedToAssignee(
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

    const notifications = await handleCertifiedAttributeRevokedToAssignee(
      toTenantV2(assignee),
      certifiedAttributeIPA.id,
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
