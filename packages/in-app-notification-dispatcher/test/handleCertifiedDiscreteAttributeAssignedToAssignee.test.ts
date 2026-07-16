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
  Attribute,
  attributeKind,
  Tenant,
} from "pagopa-interop-models";

import { handleCertifiedDiscreteAttributeAssignedToAssignee } from "../src/handlers/tenants/handleCertifiedDiscreteAttributeAssignedToAssignee.js";
import {
  attributeNotFound,
  attributeOriginUndefined,
  certifierTenantNotFound,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedDiscreteAttributeAssignedToAssignee", () => {
  const assignee = getMockTenant();
  const certifierId = generateId();
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
    features: [{ type: "PersistentCertifier", certifierId }],
  };

  const certifiedAttributeISTAT: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified ISTAT Attribute",
    origin: "ISTAT",
  };
  const certifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified Attribute",
    origin: certifierId,
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneTenant(assignee);
    await addOneTenant(certifier);
    await addOneAttribute(certifiedAttributeISTAT);
    await addOneAttribute(certifiedAttribute);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService
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

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw attributeOriginUndefined when the certified discrete attribute has undefined origin", async () => {
    const certifiedAttributeWithUndefinedOrigin: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: undefined,
    };
    await addOneAttribute(certifiedAttributeWithUndefinedOrigin);

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedDiscreteAttributeAssignedToAssignee(
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
      handleCertifiedDiscreteAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeWithUnknownCertifier.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(certifierTenantNotFound(unknownCertifierId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications =
      await handleCertifiedDiscreteAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeISTAT.id,
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("should return imported attribute body for ISTAT origin", async () => {
    const assigneeUsers = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];

    mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

    const notifications =
      await handleCertifiedDiscreteAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeISTAT.id,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(assigneeUsers.length);

    const expectedBody =
      inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
        certifiedAttributeISTAT.name
      );

    const expectedNotifications = assigneeUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      entityId: certifiedAttributeISTAT.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should return certifier body for non-imported origin", async () => {
    const assigneeUsers = [{ userId: generateId(), tenantId: assignee.id }];

    mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

    const notifications =
      await handleCertifiedDiscreteAttributeAssignedToAssignee(
        toTenantV2(assignee),
        certifiedAttribute.id,
        logger,
        readModelService
      );

    const expectedBody =
      inAppTemplates.certifiedVerifiedAttributeAssignedToAssignee(
        certifiedAttribute.name,
        "certificato",
        certifier.name
      );

    const expectedNotifications = assigneeUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      entityId: certifiedAttribute.id,
    }));

    expect(notifications).toEqual(expectedNotifications);
  });
});
