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
  purposeWaitingForApprovalReason,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  eserviceNotFound,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handlePurposeOverQuotaToConsumer } from "../src/handlers/purposes/handlePurposeOverQuotaToConsumer.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handlePurposeOverQuotaToConsumer", () => {
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
      handlePurposeOverQuotaToConsumer(
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
      handlePurposeOverQuotaToConsumer(
        toPurposeV2(purposeWithUnknownEservice),
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handlePurposeOverQuotaToConsumer(
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
      | "PurposeWaitingForApproval"
      | "PurposeVersionOverQuotaUnsuspended";
  }>([
    {
      eventType: "NewPurposeVersionWaitingForApproval",
    },
    {
      eventType: "PurposeWaitingForApproval",
    },
    {
      eventType: "PurposeVersionOverQuotaUnsuspended",
    },
  ])("should handle $eventType event correctly", async ({ eventType }) => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeOverQuotaToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      eventType
    );

    expect(notifications).toHaveLength(consumerUsers.length);

    const expectedBody = inAppTemplates.purposeOverQuotaToConsumer(
      eservice.name,
      purpose.title
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
  });

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handlePurposeOverQuotaToConsumer(
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

  it.each([
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumer,
      "con questa stima di chiamate API superi la soglia per fruitore",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsTotal,
      "sono già state superate le soglie totali",
    ],
    [
      purposeWaitingForApprovalReason.dailyCallsPerConsumerAndTotal,
      "almeno una delle soglie",
    ],
    [undefined, "almeno una delle soglie"],
  ] as const)(
    "uses event reason %s without reading descriptor quotas",
    async (reason, text) => {
      await addOneEService({ ...eservice, descriptors: [] });
      mockGetNotificationRecipients.mockResolvedValue([
        { userId: generateId(), tenantId: consumerId },
      ]);

      const notifications = await handlePurposeOverQuotaToConsumer(
        toPurposeV2({
          ...purpose,
          versions: [
            {
              ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
              waitingForApprovalReason: reason,
            },
          ],
        }),
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].body).toContain(text);
      expect(notifications[0].body).toContain(purpose.title);
    }
  );

  it("should send notifications to consumer tenant users only", async () => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeOverQuotaToConsumer(
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
      "purposeOverQuotaStateToConsumer",
      readModelService,
      logger
    );
  });

  it("should include correct notification metadata", async () => {
    const consumerUsers = [{ userId: generateId(), tenantId: consumerId }];
    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeOverQuotaToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeWaitingForApproval"
    );

    expect(notifications).toHaveLength(1);

    const notification = notifications[0];
    expect(notification.notificationType).toBe(
      "purposeOverQuotaStateToConsumer"
    );
    expect(notification.entityId).toBe(purpose.id);
    expect(notification.userId).toBe(consumerUsers[0].userId);
    expect(notification.tenantId).toBe(consumerId);
  });
});
