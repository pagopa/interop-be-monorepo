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
} from "pagopa-interop-models";

import { handleCertifiedDiscreteAttributeUpdatedToAssignee } from "../src/handlers/tenants/handleCertifiedDiscreteAttributeUpdatedToAssignee.js";
import {
  attributeNotFound,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleCertifiedDiscreteAttributeUpdatedToAssignee", () => {
  const assignee = getMockTenant();

  const certifiedAttributeISTAT: Attribute = {
    ...getMockAttribute(attributeKind.certified),
    name: "Certified ISTAT Attribute",
    origin: "ISTAT",
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneTenant(assignee);
    await addOneAttribute(certifiedAttributeISTAT);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleCertifiedDiscreteAttributeUpdatedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "tenant",
        "TenantCertifiedDiscreteAttributeUpdated"
      )
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleCertifiedDiscreteAttributeUpdatedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications =
      await handleCertifiedDiscreteAttributeUpdatedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeISTAT.id,
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("should handle updated event correctly", async () => {
    const assigneeUsers = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];

    mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

    const notifications =
      await handleCertifiedDiscreteAttributeUpdatedToAssignee(
        toTenantV2(assignee),
        certifiedAttributeISTAT.id,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(assigneeUsers.length);

    const expectedBody =
      inAppTemplates.certifiedVerifiedAttributeUpdatedToAssignee(
        certifiedAttributeISTAT.name,
        "certificato"
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
});
