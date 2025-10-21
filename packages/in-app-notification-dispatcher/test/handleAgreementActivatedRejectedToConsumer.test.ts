import { describe, it, expect, vi, beforeEach } from "vitest";
import { match } from "ts-pattern";
import {
  getMockContext,
  getMockEService,
  getMockDescriptorPublished,
  getMockAgreement,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  EServiceId,
  AgreementId,
  toAgreementV2,
} from "pagopa-interop-models";
import { handleAgreementActivatedRejectedToConsumer } from "../src/handlers/agreements/handleAgreementActivatedRejectedToConsumer.js";
import { tenantNotFound, eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleAgreementActivatedRejectedToConsumer", () => {
  const consumerId = generateId<TenantId>();
  const producerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const agreementId = generateId<AgreementId>();

  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [getMockDescriptorPublished()],
  };

  const consumerTenant = getMockTenant(consumerId);
  const producerTenant = getMockTenant(producerId);

  const agreement = {
    ...getMockAgreement(eserviceId, consumerId, agreementState.active),
    id: agreementId,
    producerId,
  };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneEService(eservice);
    await addOneTenant(consumerTenant);
    await addOneTenant(producerTenant);
    await addOneAgreement(agreement);
  });

  it("should throw missingKafkaMessageDataError when agreement is undefined for AgreementActivated", async () => {
    await expect(() =>
      handleAgreementActivatedRejectedToConsumer(
        undefined,
        logger,
        readModelService,
        "AgreementActivated"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("agreement", "AgreementActivated")
    );
  });

  it("should throw missingKafkaMessageDataError when agreement is undefined for AgreementRejected", async () => {
    await expect(() =>
      handleAgreementActivatedRejectedToConsumer(
        undefined,
        logger,
        readModelService,
        "AgreementRejected"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("agreement", "AgreementRejected")
    );
  });

  it("should throw tenantNotFound when consumer tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const agreementWithUnknownTenant = {
      ...agreement,
      producerId: unknownTenantId,
    };

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: consumerId }]);

    await expect(() =>
      handleAgreementActivatedRejectedToConsumer(
        toAgreementV2(agreementWithUnknownTenant),
        logger,
        readModelService,
        "AgreementActivated"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should throw eserviceNotFound when eservice is not found", async () => {
    const unknownEserviceId = generateId<EServiceId>();
    const agreementWithUnknownEservice = {
      ...agreement,
      eserviceId: unknownEserviceId,
    };

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: consumerId }]);

    await expect(() =>
      handleAgreementActivatedRejectedToConsumer(
        toAgreementV2(agreementWithUnknownEservice),
        logger,
        readModelService,
        "AgreementActivated"
      )
    ).rejects.toThrow(eserviceNotFound(unknownEserviceId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleAgreementActivatedRejectedToConsumer(
      toAgreementV2(agreement),
      logger,
      readModelService,
      "AgreementActivated"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType: "AgreementActivated" | "AgreementRejected";
    expectedAction: "attivato" | "rifiutato";
  }>([
    {
      eventType: "AgreementActivated",
      expectedAction: "attivato",
    },
    {
      eventType: "AgreementRejected",
      expectedAction: "rifiutato",
    },
  ])("should handle $eventType event correctly", async ({ eventType }) => {
    const consumerUsers = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(consumerUsers);

    const notifications = await handleAgreementActivatedRejectedToConsumer(
      toAgreementV2(agreement),
      logger,
      readModelService,
      eventType
    );

    expect(notifications).toHaveLength(consumerUsers.length);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const expectedBody = match(eventType)
      .with("AgreementActivated", () =>
        inAppTemplates.agreementActivatedToConsumer(
          consumerTenant.name,
          eservice.name
        )
      )
      .with("AgreementRejected", () =>
        inAppTemplates.agreementRejectedToConsumer(eservice.name)
      )
      .exhaustive();

    const expectedNotifications = consumerUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "agreementActivatedRejectedToConsumer",
      entityId: agreement.id,
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
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications = await handleAgreementActivatedRejectedToConsumer(
      toAgreementV2(agreement),
      logger,
      readModelService,
      "AgreementActivated"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
