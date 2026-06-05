/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, Mock } from "vitest";
import { match } from "ts-pattern";
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

import { handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee } from "../src/handlers/tenants/handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
} from "../src/models/errors.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee", () => {
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
  const verifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.verified),
    name: "Verified Attribute",
  };
  const certifiedAttributeISTAT: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified ISTAT Attribute",
    origin: "ISTAT",
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
    await addOneAttribute(certifiedAttributeISTAT);
    await addOneAttribute(verifiedAttribute);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService,
        "TenantCertifiedDiscreteAttributeAssigned"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "tenant",
        "TenantCertifiedDiscreteAttributeAssigned"
      )
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService,
        "TenantCertifiedDiscreteAttributeAssigned"
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw attributeOriginUndefined when the certified discrete attribute has undefined origin", async () => {
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
      handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUndefinedOrigin.id,
        logger,
        readModelService,
        "TenantCertifiedDiscreteAttributeAssigned"
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

    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService,
        "TenantCertifiedDiscreteAttributeAssigned"
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it.each<{
    eventType:
      | "TenantCertifiedDiscreteAttributeAssigned"
      | "TenantCertifiedDiscreteAttributeRevoked"
      | "TenantCertifiedDiscreteAttributeUpdated";
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantCertifiedDiscreteAttributeAssigned",
      attributeId: certifiedAttributeISTAT.id,
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeRevoked",
      attributeId: certifiedAttributeISTAT.id,
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeUpdated",
      attributeId: certifiedAttributeISTAT.id,
    },
  ])(
    "should return empty array when no users have notifications enabled",
    async ({ eventType, attributeId }) => {
      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await match(eventType)
        .with("TenantCertifiedDiscreteAttributeAssigned", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2(assignee),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeRevoked", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2(assignee),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeUpdated", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2(assignee),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .exhaustive();

      expect(notifications).toEqual([]);
    }
  );

  it.each<{
    eventType:
      | "TenantCertifiedDiscreteAttributeAssigned"
      | "TenantCertifiedDiscreteAttributeRevoked"
      | "TenantCertifiedDiscreteAttributeUpdated";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
    expectedBody: string;
  }>([
    {
      eventType: "TenantCertifiedDiscreteAttributeAssigned",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttributeISTAT.name,
        "certificato",
        "ISTAT"
      ),
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeRevoked",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        certifiedAttributeISTAT.name,
        "certificato",
        "ISTAT"
      ),
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeUpdated",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
      expectedBody: inAppTemplates.certifiedVerifiedAttributeUpdatedToAssignee(
        certifiedAttributeISTAT.name,
        "certificato"
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

      const notifications = await match(eventType)
        .with("TenantCertifiedDiscreteAttributeAssigned", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeRevoked", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeUpdated", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .exhaustive();

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
      | "TenantCertifiedDiscreteAttributeAssigned"
      | "TenantCertifiedDiscreteAttributeRevoked"
      | "TenantCertifiedDiscreteAttributeUpdated";
    assigneeAttributes: TenantAttribute[];
    attributeId: AttributeId;
  }>([
    {
      eventType: "TenantCertifiedDiscreteAttributeAssigned",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeRevoked",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
    },
    {
      eventType: "TenantCertifiedDiscreteAttributeUpdated",
      assigneeAttributes: [],
      attributeId: certifiedAttributeISTAT.id,
    },
  ])(
    "should generate notifications for multiple users",
    async ({ eventType, assigneeAttributes, attributeId }) => {
      const users = [
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
        { userId: generateId(), tenantId: assignee.id },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const notifications = await match(eventType)
        .with("TenantCertifiedDiscreteAttributeAssigned", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeRevoked", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .with("TenantCertifiedDiscreteAttributeUpdated", () =>
          handleCertifiedDiscreteAttributeAssignedRevokedUpdatedToAssignee(
            toTenantV2({ ...assignee, attributes: assigneeAttributes }),
            attributeId,
            logger,
            readModelService,
            eventType
          )
        )
        .exhaustive();

      expect(notifications).toHaveLength(3);

      // Check that all users got notifications
      const userIds = notifications.map((n) => n.userId);
      expect(userIds).toContain(users[0].userId);
      expect(userIds).toContain(users[1].userId);
      expect(userIds).toContain(users[2].userId);
    }
  );
});
