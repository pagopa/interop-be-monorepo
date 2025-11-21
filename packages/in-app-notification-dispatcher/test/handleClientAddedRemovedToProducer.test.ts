import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockEService,
  getMockDescriptorPublished,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  EServiceId,
  PurposeId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handleClientAddedRemovedToProducer } from "../src/handlers/authorizations/handleClientAddedRemovedToProducer.js";
import {
  tenantNotFound,
  eserviceNotFound,
  purposeNotFound,
} from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleClientAddedRemovedToProducer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();

  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [getMockDescriptorPublished()],
  };

  const producerTenant = getMockTenant(producerId);
  const consumerTenant = getMockTenant(consumerId);

  const purpose = {
    ...getMockPurpose([getMockPurposeVersion()]),
    id: purposeId,
    eserviceId,
    consumerId,
  };

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    await addOnePurpose(purpose);
  });

  it("should throw purposeNotFound when purpose is not found", async () => {
    const unknownPurposeId = generateId<PurposeId>();

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: producerId },
    ]);

    await expect(() =>
      handleClientAddedRemovedToProducer(
        unknownPurposeId,
        logger,
        readModelService,
        "ClientPurposeAdded"
      )
    ).rejects.toThrow(purposeNotFound(unknownPurposeId));
  });

  it("should throw eserviceNotFound when eservice is not found", async () => {
    const unknownEserviceId = generateId<EServiceId>();
    const purposeWithUnknownEservice = {
      ...purpose,
      eserviceId: unknownEserviceId,
    };

    // Update the purpose in the database
    await addOnePurpose(purposeWithUnknownEservice);

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: producerId },
    ]);

    await expect(() =>
      handleClientAddedRemovedToProducer(
        purposeWithUnknownEservice.id,
        logger,
        readModelService,
        "ClientPurposeAdded"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should throw tenantNotFound when consumer tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const purposeWithUnknownTenant = {
      ...purpose,
      consumerId: unknownTenantId,
    };

    // Update the purpose in the database
    await addOnePurpose(purposeWithUnknownTenant);

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: producerId },
    ]);

    await expect(() =>
      handleClientAddedRemovedToProducer(
        purposeWithUnknownTenant.id,
        logger,
        readModelService,
        "ClientPurposeAdded"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleClientAddedRemovedToProducer(
      purposeId,
      logger,
      readModelService,
      "ClientPurposeAdded"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType: "ClientPurposeAdded" | "ClientPurposeRemoved";
    expectedAction: "associato" | "disassociato";
  }>([
    {
      eventType: "ClientPurposeAdded",
      expectedAction: "associato",
    },
    {
      eventType: "ClientPurposeRemoved",
      expectedAction: "disassociato",
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, expectedAction }) => {
      const producerUsers = [
        { userId: generateId(), tenantId: producerId },
        { userId: generateId(), tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(producerUsers);

      const notifications = await handleClientAddedRemovedToProducer(
        purposeId,
        logger,
        readModelService,
        eventType
      );

      expect(notifications).toHaveLength(producerUsers.length);

      const expectedBody = inAppTemplates.clientAddedRemovedToProducer(
        purpose.title,
        eservice.name,
        consumerTenant.name,
        expectedAction
      );

      const expectedNotifications = producerUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "clientAddedRemovedToProducer",
        entityId: purpose.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleClientAddedRemovedToProducer(
      purposeId,
      logger,
      readModelService,
      "ClientPurposeAdded"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
