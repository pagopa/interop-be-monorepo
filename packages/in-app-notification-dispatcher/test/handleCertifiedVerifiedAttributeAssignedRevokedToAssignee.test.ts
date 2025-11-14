/* eslint-disable functional/immutable-data */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { handleCertifiedVerifiedAttributeAssignedRevokedToAssignee } from "../src/handlers/tenants/handleCertifiedVerifiedAttributeAssignedRevokedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
} from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedVerifiedAttributeAssignedRevokedToAssignee", () => {
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
  const verifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.verified),
    name: "Verified Attribute",
  };

  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneTenant(assignee);
    await addOneTenant(certifier);
    await addOneTenant(verifier);
    await addOneTenant(revoker);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(certifiedAttributeANAC);
    await addOneAttribute(certifiedAttributeIPA);
    await addOneAttribute(certifiedAttributeIVASS);
    await addOneAttribute(verifiedAttribute);
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

  it("should throw attributeOriginUndefined when the certified attribute has undefined origin", async () => {
    const certifiedAttributeWithUndefinedOrigin: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: undefined,
    };
    await addOneAttribute(certifiedAttributeWithUndefinedOrigin);

    // Mock notification service to return users (so the check doesn't exit early)
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: assignee.id }]);

    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
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

    // Mock notification service to return users (so the check doesn't exit early)
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: assignee.id }]);

    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService,
        "TenantCertifiedAttributeAssigned"
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it("should throw verifiedAttributeNotFoundInTenant when the verified attribute is not found", async () => {
    // Mock notification service to return users (so the check doesn't exit early)
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: assignee.id }]);

    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
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

    // Mock notification service to return users (so the check doesn't exit early)
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: assignee.id }]);

    await expect(() =>
      handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
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

  it("should return empty array when no users have notifications enabled", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications =
      await handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
        toTenantV2(assignee),
        certifiedAttribute.id,
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

      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(assigneeUsers);

      const notifications =
        await handleCertifiedVerifiedAttributeAssignedRevokedToAssignee(
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
        certifiedAttribute.id,
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
