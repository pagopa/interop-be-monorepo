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
  EServiceId,
} from "pagopa-interop-models";
import { tenantNotFound } from "../src/models/errors.js";
import { handleDelegationApprovedRejectedToDelegator } from "../src/handlers/delegations/handleDelegationApprovedRejectedToDelegator.js";
import {
  addOneDelegation,
  addOneTenant,
  addOneEService,
  readModelService,
} from "./utils.js";

describe("handleDelegationApprovedRejectedToDelegator", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();
  const eserviceId: EServiceId = generateId();

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
      handleDelegationApprovedRejectedToDelegator(
        undefined,
        logger,
        readModelService,
        "ProducerDelegationApproved"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("delegation", "ProducerDelegationApproved")
    );
  });

  it("should throw tenantNotFound when delegate tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const delegationWithUnknownDelegate = {
      ...delegation,
      delegateId: unknownTenantId,
    };

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: delegator.id }]);

    await expect(() =>
      handleDelegationApprovedRejectedToDelegator(
        toDelegationV2(delegationWithUnknownDelegate),
        logger,
        readModelService,
        "ProducerDelegationApproved"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleDelegationApprovedRejectedToDelegator(
      toDelegationV2(delegation),
      logger,
      readModelService,
      "ProducerDelegationApproved"
    );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "ProducerDelegationApproved"
      | "ConsumerDelegationApproved"
      | "ProducerDelegationRejected"
      | "ConsumerDelegationRejected";
    kind: DelegationKind;
    expectedBody: string;
  }>([
    {
      eventType: "ProducerDelegationApproved",
      kind: delegationKind.delegatedProducer,
      expectedBody: `Ti informiamo che l'ente ${delegate.name} ha approvato la delega all'erogazione che il tuo ente gli ha conferito per l'e-service <strong>Test EService</strong>. La delega è ora attiva.`,
    },
    {
      eventType: "ConsumerDelegationApproved",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `Ti informiamo che l'ente ${delegate.name} ha approvato la delega alla fruizione che il tuo ente gli ha conferito per l'e-service <strong>Test EService</strong>. La delega è ora attiva.`,
    },
    {
      eventType: "ProducerDelegationRejected",
      kind: delegationKind.delegatedProducer,
      expectedBody: `Ti informiamo che l'ente ${delegate.name} ha rifiutato la delega all'erogazione che il tuo ente gli ha conferito per l'e-service <strong>Test EService</strong>.`,
    },
    {
      eventType: "ConsumerDelegationRejected",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `Ti informiamo che l'ente ${delegate.name} ha rifiutato la delega alla fruizione che il tuo ente gli ha conferito per l'e-service <strong>Test EService</strong>.`,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, kind, expectedBody }) => {
      const delegatorUsers = [
        { userId: generateId(), tenantId: delegator.id },
        { userId: generateId(), tenantId: delegator.id },
      ];

      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(delegatorUsers);

      const notifications = await handleDelegationApprovedRejectedToDelegator(
        toDelegationV2({ ...delegation, kind }),
        logger,
        readModelService,
        eventType
      );

      expect(notifications).toHaveLength(delegatorUsers.length);

      const expectedNotifications = delegatorUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "delegationApprovedRejectedToDelegator",
        entityId: delegation.id,
      }));

      expect(notifications).toEqual(
        expect.arrayContaining(expectedNotifications)
      );
    }
  );

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: delegator.id },
      { userId: generateId(), tenantId: delegator.id },
      { userId: generateId(), tenantId: delegator.id },
    ];
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const notifications = await handleDelegationApprovedRejectedToDelegator(
      toDelegationV2(delegation),
      logger,
      readModelService,
      "ProducerDelegationApproved"
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
