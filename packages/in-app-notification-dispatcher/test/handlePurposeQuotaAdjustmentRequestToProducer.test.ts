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
import { handlePurposeQuotaAdjustmentRequestToProducer } from "../src/handlers/purposes/handlePurposeQuotaAdjustmentRequestToProducer.js";
import { tenantNotFound, eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handlePurposeQuotaAdjustmentRequestToProducer", () => {
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
      handlePurposeQuotaAdjustmentRequestToProducer(
        undefined,
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeWaitingForApproval")
    );
  });

  it("should throw tenantNotFound when consumer tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const purposeWithUnknownTenant = {
      ...purpose,
      consumerId: unknownTenantId,
    };

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: producerId },
    ]);

    await expect(() =>
      handlePurposeQuotaAdjustmentRequestToProducer(
        toPurposeV2(purposeWithUnknownTenant),
        logger,
        readModelService,
        "PurposeWaitingForApproval"
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
      { userId: generateId(), tenantId: producerId },
    ]);

    await expect(() =>
      handlePurposeQuotaAdjustmentRequestToProducer(
        toPurposeV2(purposeWithUnknownEservice),
        logger,
        readModelService,
        "PurposeWaitingForApproval"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handlePurposeQuotaAdjustmentRequestToProducer(
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
    templateFunction:
      | "purposeQuotaAdjustmentNewVersionToProducer"
      | "purposeQuotaAdjustmentFirstVersionToProducer";
  }>([
    {
      eventType: "NewPurposeVersionWaitingForApproval",
      templateFunction: "purposeQuotaAdjustmentNewVersionToProducer",
    },
    {
      eventType: "PurposeWaitingForApproval",
      templateFunction: "purposeQuotaAdjustmentFirstVersionToProducer",
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, templateFunction }) => {
      const producerUsers = [
        { userId: generateId(), tenantId: producerId },
        { userId: generateId(), tenantId: producerId },
      ];

      mockGetNotificationRecipients.mockResolvedValue(producerUsers);

      const notifications = await handlePurposeQuotaAdjustmentRequestToProducer(
        toPurposeV2(purpose),
        logger,
        readModelService,
        eventType
      );

      expect(notifications).toHaveLength(producerUsers.length);

      const expectedBody = inAppTemplates[templateFunction](
        consumerTenant.name,
        purpose.title,
        eservice.name
      );

      const expectedNotifications = producerUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "purposeQuotaAdjustmentRequestToProducer",
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

    const notifications = await handlePurposeQuotaAdjustmentRequestToProducer(
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
});
