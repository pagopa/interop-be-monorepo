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
import { handleAgreementManagementToProducer } from "../src/handlers/agreements/handleAgreementManagementToProducer.js";
import { tenantNotFound, eserviceNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleAgreementManagementToProducer", () => {
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
      handleAgreementManagementToProducer(
        undefined,
        logger,
        readModelService,
        "AgreementActivated"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("agreement", "AgreementActivated")
    );
  });

  it("should throw tenantNotFound when consumer tenant is not found", async () => {
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
      handleAgreementManagementToProducer(
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
      .mockResolvedValue([{ userId: generateId(), tenantId: producerId }]);

    await expect(() =>
      handleAgreementManagementToProducer(
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

    const notifications = await handleAgreementManagementToProducer(
      toAgreementV2(agreement),
      logger,
      readModelService,
      "AgreementActivated"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "AgreementActivated"
      | "AgreementSubmitted"
      | "AgreementUpgraded";
    expectedAction: "attivato" | "creato" | "aggiornato";
  }>([
    {
      eventType: "AgreementActivated",
      expectedAction: "attivato",
    },
    {
      eventType: "AgreementSubmitted",
      expectedAction: "creato",
    },
    {
      eventType: "AgreementUpgraded",
      expectedAction: "aggiornato",
    },
  ])("should handle $eventType event correctly", async ({ eventType }) => {
    const producerUsers = [
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
    ];

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(producerUsers);

    const notifications = await handleAgreementManagementToProducer(
      toAgreementV2(agreement),
      logger,
      readModelService,
      eventType
    );

    expect(notifications).toHaveLength(producerUsers.length);

    // Use the same template function as the implementation for each event type
    const templateMap = {
      AgreementActivated: inAppTemplates.agreementActivatedToProducer,
      AgreementSubmitted: inAppTemplates.agreementSubmittedToProducer,
      AgreementUpgraded: inAppTemplates.agreementUpgradedToProducer,
    };
    const expectedBody = templateMap[eventType](
      consumerTenant.name,
      eservice.name
    );

    const expectedNotifications = producerUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: expectedBody,
      notificationType: "agreementManagementToProducer",
      entityId: agreement.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
    ];
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications = await handleAgreementManagementToProducer(
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
