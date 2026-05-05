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
  missingKafkaMessageDataError,
  TenantId,
  EServiceId,
  PurposeId,
  toPurposeV2,
  purposeVersionState,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handlePurposeQuotaAdjustmentResponseToConsumer } from "../src/handlers/purposes/handlePurposeQuotaAdjustmentResponseToConsumer.js";
import { tenantNotFound, eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handlePurposeQuotaAdjustmentResponseToConsumer", () => {
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

  // Purpose with multiple versions (> 1) to trigger the notification
  const purpose = {
    ...getMockPurpose([
      getMockPurposeVersion(purposeVersionState.active),
      getMockPurposeVersion(purposeVersionState.active),
    ]),
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

  it("should throw missingKafkaMessageDataError when purpose is undefined", async () => {
    await expect(() =>
      handlePurposeQuotaAdjustmentResponseToConsumer(
        undefined,
        logger,
        readModelService,
        "PurposeVersionActivated"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeVersionActivated")
    );

    await expect(() =>
      handlePurposeQuotaAdjustmentResponseToConsumer(
        undefined,
        logger,
        readModelService,
        "PurposeVersionRejected"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeVersionRejected")
    );
  });

  it("should return empty array when purpose has only one version", async () => {
    const purposeWithOneVersion = {
      ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
      id: generateId<PurposeId>(),
      eserviceId,
      consumerId,
    };

    await addOnePurpose(purposeWithOneVersion);

    const notifications = await handlePurposeQuotaAdjustmentResponseToConsumer(
      toPurposeV2(purposeWithOneVersion),
      logger,
      readModelService,
      "PurposeVersionActivated"
    );

    expect(notifications).toEqual([]);
  });

  it("should throw tenantNotFound when producer tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const eserviceWithUnknownTenant = {
      ...eservice,
      producerId: unknownTenantId,
    };

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: consumerId },
    ]);

    await addOneEService(eserviceWithUnknownTenant);

    await expect(() =>
      handlePurposeQuotaAdjustmentResponseToConsumer(
        toPurposeV2(purpose),
        logger,
        readModelService,
        "PurposeVersionActivated"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should throw eserviceNotFound when eservice is not found", async () => {
    const unknownEserviceId = generateId<EServiceId>();
    const purposeWithUnknownEservice = {
      ...purpose,
      eserviceId: unknownEserviceId,
    };

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: consumerId },
    ]);

    await expect(() =>
      handlePurposeQuotaAdjustmentResponseToConsumer(
        toPurposeV2(purposeWithUnknownEservice),
        logger,
        readModelService,
        "PurposeVersionActivated"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handlePurposeQuotaAdjustmentResponseToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeVersionActivated"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType: "PurposeVersionActivated" | "PurposeVersionRejected";
    action: "accettato" | "rifiutato";
  }>([
    {
      eventType: "PurposeVersionActivated",
      action: "accettato",
    },
    {
      eventType: "PurposeVersionRejected",
      action: "rifiutato",
    },
  ])(
    "should handle $eventType event correctly with action $action",
    async ({ eventType, action }) => {
      const consumerUsers = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

      const notifications =
        await handlePurposeQuotaAdjustmentResponseToConsumer(
          toPurposeV2(purpose),
          logger,
          readModelService,
          eventType
        );

      expect(notifications).toHaveLength(consumerUsers.length);

      const expectedBody =
        inAppTemplates.purposeQuotaAdjustmentResponseToConsumer(
          producerTenant.name,
          purpose.title,
          eservice.name,
          action
        );

      const expectedNotifications = consumerUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "purposeOverQuotaStateToConsumer",
        entityId: purpose.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
      expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
        [consumerId],
        "purposeOverQuotaStateToConsumer",
        expect.any(Object),
        expect.any(Object)
      );
    }
  );

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handlePurposeQuotaAdjustmentResponseToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeVersionActivated"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });

  it("should use correct notification type for both event types", async () => {
    const users = [{ userId: generateId(), tenantId: consumerId }];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notificationsActivated =
      await handlePurposeQuotaAdjustmentResponseToConsumer(
        toPurposeV2(purpose),
        logger,
        readModelService,
        "PurposeVersionActivated"
      );

    const notificationsRejected =
      await handlePurposeQuotaAdjustmentResponseToConsumer(
        toPurposeV2(purpose),
        logger,
        readModelService,
        "PurposeVersionRejected"
      );

    expect(notificationsActivated[0].notificationType).toBe(
      "purposeOverQuotaStateToConsumer"
    );
    expect(notificationsRejected[0].notificationType).toBe(
      "purposeOverQuotaStateToConsumer"
    );
  });
});
