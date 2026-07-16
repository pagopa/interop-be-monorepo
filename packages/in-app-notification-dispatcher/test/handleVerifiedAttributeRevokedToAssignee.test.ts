/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, Mock } from "vitest";
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
import { handleVerifiedAttributeRevokedToAssignee } from "../src/handlers/tenants/handleVerifiedAttributeRevokedToAssignee.js";
import {
  attributeNotFound,
  tenantNotFound,
  verifiedAttributeNotFoundInTenant,
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { addOneAttribute, addOneTenant, readModelService } from "./utils.js";

describe("handleVerifiedAttributeRevokedToAssignee", () => {
  const assignee = getMockTenant();
  const revoker: Tenant = {
    ...getMockTenant(),
    name: "Revoker Name",
  };
  const certifier: Tenant = {
    ...getMockTenant(),
    name: "Certifier Name",
  };

  const verifiedAttribute: Attribute = {
    ...getMockAttribute(attributeKind.verified),
    name: "Verified Attribute",
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneTenant(assignee);
    await addOneTenant(revoker);
    await addOneTenant(certifier);
    await addOneAttribute(verifiedAttribute);
  });

  it("should throw missingKafkaMessageDataError when tenant is undefined", async () => {
    await expect(() =>
      handleVerifiedAttributeRevokedToAssignee(
        undefined,
        generateId(),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantVerifiedAttributeRevoked")
    );
  });

  it("should throw attributeNotFound when attribute is not found", async () => {
    const unknownAttributeId = generateId<AttributeId>();

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeRevokedToAssignee(
        toTenantV2(assignee),
        unknownAttributeId,
        logger,
        readModelService
      )
    ).rejects.toThrow(attributeNotFound(unknownAttributeId));
  });

  it("should throw verifiedAttributeNotFoundInTenant when the verified attribute is not found", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeRevokedToAssignee(
        toTenantV2({ ...assignee, attributes: [] }),
        verifiedAttribute.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      verifiedAttributeNotFoundInTenant(assignee.id, verifiedAttribute.id)
    );
  });

  it("should throw tenantNotFound when the revoker is not found", async () => {
    const unknownRevokerId = generateId<TenantId>();

    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: assignee.id },
    ]);

    await expect(() =>
      handleVerifiedAttributeRevokedToAssignee(
        toTenantV2({
          ...assignee,
          attributes: [
            {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              revokedBy: [
                {
                  id: unknownRevokerId,
                  verificationDate: new Date(Date.now() - 10000),
                  revocationDate: new Date(),
                },
              ],
            },
          ],
        }),
        verifiedAttribute.id,
        logger,
        readModelService
      )
    ).rejects.toThrow(tenantNotFound(unknownRevokerId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleVerifiedAttributeRevokedToAssignee(
      toTenantV2(assignee),
      verifiedAttribute.id,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should handle revoked event correctly", async () => {
    const assigneeAttributes: TenantAttribute[] = [
      {
        ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
        revokedBy: [
          {
            id: revoker.id,
            verificationDate: new Date(Date.now() - 10000),
            revocationDate: new Date(),
          },
          {
            id: certifier.id,
            verificationDate: new Date(Date.now() - 20000),
            revocationDate: new Date(Date.now() - 10000),
          },
        ],
      },
    ];
    const assigneeUsers = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];

    mockGetNotificationRecipients.mockResolvedValue(assigneeUsers);

    const notifications = await handleVerifiedAttributeRevokedToAssignee(
      toTenantV2({ ...assignee, attributes: assigneeAttributes }),
      verifiedAttribute.id,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(assigneeUsers.length);

    const expectedBody =
      inAppTemplates.certifiedVerifiedAttributeRevokedToAssignee(
        verifiedAttribute.name,
        "verificato",
        "Revoker Name"
      );

    const expectedNotifications = assigneeUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      entityId: verifiedAttribute.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should generate notifications for multiple users", async () => {
    const assigneeAttributes: TenantAttribute[] = [
      {
        ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
        revokedBy: [
          {
            id: revoker.id,
            verificationDate: new Date(Date.now() - 10000),
            revocationDate: new Date(),
          },
        ],
      },
    ];
    const users = [
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
      { userId: generateId(), tenantId: assignee.id },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleVerifiedAttributeRevokedToAssignee(
      toTenantV2({ ...assignee, attributes: assigneeAttributes }),
      verifiedAttribute.id,
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
