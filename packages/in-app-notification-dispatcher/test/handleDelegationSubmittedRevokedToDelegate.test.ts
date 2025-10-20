import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMockContext,
  getMockTenant,
  getMockDelegation,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  delegationKind,
  toDelegationV2,
  DelegationKind,
} from "pagopa-interop-models";
import { tenantNotFound } from "../src/models/errors.js";
import { handleDelegationSubmittedRevokedToDelegate } from "../src/handlers/delegations/handleDelegationSubmittedRevokedToDelegate.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEService,
  readModelService,
} from "./utils.js";

describe("handleDelegationSubmittedRevokedToDelegate", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();
  const eserviceId = generateId<import("pagopa-interop-models").EServiceId>();
  // Create a mock eService with the same eserviceId and required fields
  const eservice = {
    id: eserviceId,
    name: "Test EService",
    producerId: delegator.id,
    createdAt: new Date(),
    description: "Test EService description",
    technology: "Rest" as const,
    descriptors: [],
    riskAnalysis: [],
    mode: "Deliver" as const,
  };
  const delegation = getMockDelegation({
    kind: randomArrayItem(Object.values(delegationKind)),
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId,
  });

  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
  });

  it("should throw missingKafkaMessageDataError when delegation is undefined", async () => {
    await expect(() =>
      handleDelegationSubmittedRevokedToDelegate(
        undefined,
        logger,
        readModelService,
        "ProducerDelegationSubmitted"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("delegation", "ProducerDelegationSubmitted")
    );
  });

  it("should throw tenantNotFound when delegator tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const delegationWithUnknownDelegator = {
      ...delegation,
      delegatorId: unknownTenantId,
    };

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: delegate.id }]);

    await expect(() =>
      handleDelegationSubmittedRevokedToDelegate(
        toDelegationV2(delegationWithUnknownDelegator),
        logger,
        readModelService,
        "ProducerDelegationSubmitted"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleDelegationSubmittedRevokedToDelegate(
      toDelegationV2(delegation),
      logger,
      readModelService,
      "ProducerDelegationSubmitted"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "ProducerDelegationSubmitted"
      | "ConsumerDelegationSubmitted"
      | "ProducerDelegationRevoked"
      | "ConsumerDelegationRevoked";
    kind: DelegationKind;
    expectedBody: string;
  }>([
    {
      eventType: "ProducerDelegationSubmitted",
      kind: delegationKind.delegatedProducer,
      expectedBody: `Hai ricevuto una richiesta di delega all'erogazione dall'ente ${delegator.name} per l'e-service <strong>${eservice.name}</strong>.`,
    },
    {
      eventType: "ConsumerDelegationSubmitted",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `Hai ricevuto una richiesta di delega alla fruizione dall'ente ${delegator.name} per l'e-service <strong>${eservice.name}</strong>.`,
    },
    {
      eventType: "ProducerDelegationRevoked",
      kind: delegationKind.delegatedProducer,
      expectedBody: `Ti informiamo che l'ente ${delegator.name} ha revocato la delega all'erogazione per l'e-service <strong>${eservice.name}</strong> che ti aveva conferito.`,
    },
    {
      eventType: "ConsumerDelegationRevoked",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `Ti informiamo che l'ente ${delegator.name} ha revocato la delega alla fruizione per l'e-service <strong>${eservice.name}</strong> che ti aveva conferito.`,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, kind, expectedBody }) => {
      const delegateUsers = [
        { userId: generateId(), tenantId: delegate.id },
        { userId: generateId(), tenantId: delegate.id },
      ];

      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(delegateUsers);

      const notifications = await handleDelegationSubmittedRevokedToDelegate(
        toDelegationV2({ ...delegation, kind }),
        logger,
        readModelService,
        eventType
      );

      expect(notifications).toHaveLength(delegateUsers.length);

      const expectedNotifications = delegateUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "delegationSubmittedRevokedToDelegate",
        entityId: delegation.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: delegate.id },
      { userId: generateId(), tenantId: delegate.id },
      { userId: generateId(), tenantId: delegate.id },
    ];
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications = await handleDelegationSubmittedRevokedToDelegate(
      toDelegationV2(delegation),
      logger,
      readModelService,
      "ProducerDelegationSubmitted"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
