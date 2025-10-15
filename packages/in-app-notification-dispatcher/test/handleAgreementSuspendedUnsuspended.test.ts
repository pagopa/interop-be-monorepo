import { describe, it, expect, vi, beforeEach } from "vitest";
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
import {
  AgreementSuspendedUnsuspendedEventType,
  handleAgreementSuspendedUnsuspended,
} from "../src/handlers/agreements/handleAgreementSuspendedUnsuspended.js";
import { tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleAgreementSuspendedUnsuspended", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const agreementId = generateId<AgreementId>();

  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [getMockDescriptorPublished()],
  };

  const producerTenant = getMockTenant(producerId);
  const consumerTenant = getMockTenant(consumerId);

  const agreement = {
    ...getMockAgreement(eserviceId, consumerId, agreementState.active),
    id: agreementId,
    producerId,
  };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    await addOneAgreement(agreement);
  });

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
    await expect(() =>
      handleAgreementSuspendedUnsuspended(
        undefined,
        logger,
        readModelService,
        "AgreementSuspendedByConsumer"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("agreement", "AgreementSuspendedByConsumer")
    );
  });

  it("should throw tenantNotFound when tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const agreementWithUnknownTenant = {
      ...agreement,
      consumerId: unknownTenantId,
    };

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: producerId }]);

    await expect(() =>
      handleAgreementSuspendedUnsuspended(
        toAgreementV2(agreementWithUnknownTenant),
        logger,
        readModelService,
        "AgreementSuspendedByConsumer"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleAgreementSuspendedUnsuspended(
      toAgreementV2(agreement),
      logger,
      readModelService,
      "AgreementSuspendedByConsumer"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType: AgreementSuspendedUnsuspendedEventType;
    expectedAudience: "consumer" | "producer" | "both";
    expectedAction: "sospeso" | "riattivato" | "archiviato";
    expectedSubject: string;
  }>([
    {
      eventType: "AgreementSuspendedByConsumer",
      expectedAudience: "producer",
      expectedAction: "sospeso",
      expectedSubject: consumerTenant.name,
    },
    {
      eventType: "AgreementUnsuspendedByConsumer",
      expectedAudience: "producer",
      expectedAction: "riattivato",
      expectedSubject: consumerTenant.name,
    },
    {
      eventType: "AgreementSuspendedByProducer",
      expectedAudience: "consumer",
      expectedAction: "sospeso",
      expectedSubject: producerTenant.name,
    },
    {
      eventType: "AgreementUnsuspendedByProducer",
      expectedAudience: "consumer",
      expectedAction: "riattivato",
      expectedSubject: producerTenant.name,
    },
    {
      eventType: "AgreementSuspendedByPlatform",
      expectedAudience: "both",
      expectedAction: "sospeso",
      expectedSubject: "La piattaforma",
    },
    {
      eventType: "AgreementUnsuspendedByPlatform",
      expectedAudience: "both",
      expectedAction: "riattivato",
      expectedSubject: "La piattaforma",
    },
    {
      eventType: "AgreementArchivedByConsumer",
      expectedAudience: "producer",
      expectedAction: "archiviato",
      expectedSubject: consumerTenant.name,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, expectedAudience, expectedSubject }) => {
      const producerUsers = [
        { userId: generateId(), tenantId: producerId },
        { userId: generateId(), tenantId: producerId },
      ];
      const consumerUsers = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];

      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockImplementation(async (_, notificationConfig) => {
          if (
            notificationConfig === "agreementSuspendedUnsuspendedToProducer"
          ) {
            return producerUsers;
          } else if (
            notificationConfig === "agreementSuspendedUnsuspendedToConsumer"
          ) {
            return consumerUsers;
          }
          return [];
        });

      const notifications = await handleAgreementSuspendedUnsuspended(
        toAgreementV2(agreement),
        logger,
        readModelService,
        eventType
      );

      const expectedUsers: Array<{ userId: string; tenantId: string }> =
        expectedAudience === "producer"
          ? producerUsers
          : expectedAudience === "consumer"
          ? consumerUsers
          : expectedAudience === "both"
          ? [...producerUsers, ...consumerUsers]
          : [];

      expect(notifications).toHaveLength(expectedUsers.length);

      // Use the same template function as the implementation for each event type
      const templateMap = {
        AgreementSuspendedByConsumer:
          inAppTemplates.agreementSuspendedToProducer,
        AgreementUnsuspendedByConsumer:
          inAppTemplates.agreementUnsuspendedByConsumerToProducer,
        AgreementSuspendedByProducer:
          inAppTemplates.agreementSuspendedByProducerToConsumer,
        AgreementUnsuspendedByProducer:
          inAppTemplates.agreementUnsuspendedByProducerToConsumer,
        AgreementSuspendedByPlatform:
          inAppTemplates.agreementSuspendedByPlatformToProducer,
        AgreementUnsuspendedByPlatform:
          inAppTemplates.agreementUnsuspendedByPlatformToProducer,
        AgreementArchivedByConsumer:
          inAppTemplates.agreementArchivedByConsumerToProducer,
      };
      const expectedBody = templateMap[eventType](
        expectedSubject,
        eservice.name
      );

      const expectedNotifications = expectedUsers.map((user) => {
        // Determine the notification type based on which audience this user belongs to
        const isProducerUser = producerUsers.some(
          (p) => p.userId === user.userId
        );
        const notificationType = isProducerUser
          ? "agreementSuspendedUnsuspendedToProducer"
          : "agreementSuspendedUnsuspendedToConsumer";

        return {
          userId: user.userId,
          tenantId: user.tenantId,
          body: expectedBody,
          notificationType,
          entityId: agreement.id,
        };
      });

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

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

    const notifications = await handleAgreementSuspendedUnsuspended(
      toAgreementV2(agreement),
      logger,
      readModelService,
      "AgreementSuspendedByConsumer"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
