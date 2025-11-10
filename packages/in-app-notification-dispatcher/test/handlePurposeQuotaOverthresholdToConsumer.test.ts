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
import { handlePurposeQuotaOverthresholdToConsumer } from "../src/handlers/purposes/handlePurposeQuotaOverthresholdToConsumer.js";
import { eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handlePurposeQuotaOverthresholdToConsumer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();

  const dailyCallsPerConsumer = 1000;
  const descriptor = {
    ...getMockDescriptorPublished(),
    dailyCallsPerConsumer,
  };

  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };

  const producerTenant = getMockTenant(producerId);
  const consumerTenant = getMockTenant(consumerId);

  const purpose = {
    ...getMockPurpose([
      getMockPurposeVersion(purposeVersionState.waitingForApproval),
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
      handlePurposeQuotaOverthresholdToConsumer(
        undefined,
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeWaitingForApproval")
    );
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
      handlePurposeQuotaOverthresholdToConsumer(
        toPurposeV2(purposeWithUnknownEservice),
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "NewPurposeVersionWaitingForApproval"
      | "PurposeWaitingForApproval";
  }>([
    {
      eventType: "NewPurposeVersionWaitingForApproval",
    },
    {
      eventType: "PurposeWaitingForApproval",
    },
  ])("should handle $eventType event correctly", async ({ eventType }) => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      eventType
    );

    expect(notifications).toHaveLength(consumerUsers.length);

    const expectedBody = inAppTemplates.purposeQuotaOverthresholdToConsumer(
      eservice.name,
      dailyCallsPerConsumer
    );

    const expectedNotifications = consumerUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "purposeQuotaOverthresholdStateToConsumer",
      entityId: purpose.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });

  it("should use dailyCallsPerConsumer from the latest published descriptor", async () => {
    const olderDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 500,
      version: "1",
      publishedAt: new Date("2023-01-01"),
    };
    const newerDescriptor = {
      ...getMockDescriptorPublished(),
      dailyCallsPerConsumer: 2000,
      version: "2",
      publishedAt: new Date("2024-01-01"),
    };

    const eserviceWithMultipleDescriptors = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [olderDescriptor, newerDescriptor],
    };

    await addOneEService(eserviceWithMultipleDescriptors);

    const purposeForMultiDescriptor = {
      ...getMockPurpose([
        getMockPurposeVersion(purposeVersionState.waitingForApproval),
      ]),
      id: generateId<PurposeId>(),
      eserviceId: eserviceWithMultipleDescriptors.id,
      consumerId,
    };
    await addOnePurpose(purposeForMultiDescriptor);

    const consumerUsers = [{ userId: generateId(), tenantId: consumerId }];
    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purposeForMultiDescriptor),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toHaveLength(1);

    // Should use the newer descriptor's dailyCallsPerConsumer value
    const expectedBody = inAppTemplates.purposeQuotaOverthresholdToConsumer(
      eserviceWithMultipleDescriptors.name,
      2000
    );

    expect(notifications[0].body).toEqual(expectedBody);
  });

  it("should send notifications to consumer tenant users only", async () => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toHaveLength(consumerUsers.length);

    // Verify all notifications are for consumer tenant
    notifications.forEach((notification) => {
      expect(notification.tenantId).toBe(consumerId);
    });

    // Verify getNotificationRecipients was called with consumer tenant ID
    expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
      [consumerId],
      "purposeQuotaOverthresholdStateToConsumer",
      readModelService,
      logger
    );
  });

  it("should include correct notification metadata", async () => {
    const consumerUsers = [{ userId: generateId(), tenantId: consumerId }];
    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeQuotaOverthresholdToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toHaveLength(1);

    const notification = notifications[0];
    expect(notification.notificationType).toBe(
      "purposeQuotaOverthresholdStateToConsumer"
    );
    expect(notification.entityId).toBe(purpose.id);
    expect(notification.userId).toBe(consumerUsers[0].userId);
    expect(notification.tenantId).toBe(consumerId);
  });
});
