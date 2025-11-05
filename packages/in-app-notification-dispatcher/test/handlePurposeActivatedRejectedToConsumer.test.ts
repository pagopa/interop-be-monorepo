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
import { match } from "ts-pattern";
import { handlePurposeActivatedRejectedToConsumer } from "../src/handlers/purposes/handlePurposeActivatedRejectedToConsumer.js";
import { tenantNotFound, eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handlePurposeActivatedRejectedToConsumer", () => {
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
    ...getMockPurpose([getMockPurposeVersion(purposeVersionState.active)]),
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
      handlePurposeActivatedRejectedToConsumer(
        undefined,
        logger,
        readModelService,
        "PurposeVersionActivated"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeVersionActivated")
    );

    await expect(() =>
      handlePurposeActivatedRejectedToConsumer(
        undefined,
        logger,
        readModelService,
        "PurposeVersionRejected"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeVersionRejected")
    );
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
      handlePurposeActivatedRejectedToConsumer(
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
      handlePurposeActivatedRejectedToConsumer(
        toPurposeV2(purposeWithUnknownEservice),
        logger,
        readModelService,
        "PurposeVersionActivated"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handlePurposeActivatedRejectedToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      "PurposeVersionActivated"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType: "PurposeVersionActivated" | "PurposeVersionRejected";
  }>([
    {
      eventType: "PurposeVersionActivated",
    },
    {
      eventType: "PurposeVersionRejected",
    },
  ])("should handle $eventType event correctly", async ({ eventType }) => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    mockGetNotificationRecipients.mockResolvedValue(consumerUsers);

    const notifications = await handlePurposeActivatedRejectedToConsumer(
      toPurposeV2(purpose),
      logger,
      readModelService,
      eventType
    );

    expect(notifications).toHaveLength(consumerUsers.length);

    const expectedBody = match(eventType)
      .with("PurposeVersionActivated", () =>
        inAppTemplates.purposeActivatedToConsumer(
          purpose.title,
          producerTenant.name,
          eservice.name
        )
      )
      .with("PurposeVersionRejected", () =>
        inAppTemplates.purposeRejectedToConsumer(
          purpose.title,
          producerTenant.name,
          eservice.name
        )
      )
      .exhaustive();

    const expectedNotifications = consumerUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "purposeActivatedRejectedToConsumer",
      entityId: purpose.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
    expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
      expect.any(Array),
      "purposeActivatedRejectedToConsumer",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handlePurposeActivatedRejectedToConsumer(
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
});
