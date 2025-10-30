import { describe, it, expect, beforeEach, Mock } from "vitest";
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
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handleDelegationApprovedRejectedToDelegator } from "../src/handlers/delegations/handleDelegationApprovedRejectedToDelegator.js";
import { addOneDelegation, addOneTenant, readModelService } from "./utils.js";

describe("handleDelegationApprovedRejectedToDelegator", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();

  const delegation = getMockDelegation({
    kind: randomArrayItem(Object.values(delegationKind)),
    delegatorId: delegator.id,
    delegateId: delegate.id,
  });

  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    // Setup test data
    await addOneTenant(delegator);
    await addOneTenant(delegate);
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

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: delegator.id },
    ]);

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
    mockGetNotificationRecipients.mockResolvedValue([]);

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
    rejectionReason?: string;
    expectedBody: string;
  }>([
    {
      eventType: "ProducerDelegationApproved",
      kind: delegationKind.delegatedProducer,
      rejectionReason: undefined,
      expectedBody: `${delegate.name} ha approvato la delega in erogazione.`,
    },
    {
      eventType: "ConsumerDelegationApproved",
      kind: delegationKind.delegatedConsumer,
      rejectionReason: undefined,
      expectedBody: `${delegate.name} ha approvato la delega in fruizione.`,
    },
    {
      eventType: "ProducerDelegationRejected",
      kind: delegationKind.delegatedProducer,
      rejectionReason: "mock reason",
      expectedBody: `${delegate.name} ha rifiutato la delega in erogazione. Motivo: mock reason.`,
    },
    {
      eventType: "ConsumerDelegationRejected",
      kind: delegationKind.delegatedConsumer,
      rejectionReason: "mock reason",
      expectedBody: `${delegate.name} ha rifiutato la delega in fruizione. Motivo: mock reason.`,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, kind, rejectionReason, expectedBody }) => {
      const delegatorUsers = [
        { userId: generateId(), tenantId: delegator.id },
        { userId: generateId(), tenantId: delegator.id },
      ];

      mockGetNotificationRecipients.mockResolvedValue(delegatorUsers);

      const notifications = await handleDelegationApprovedRejectedToDelegator(
        toDelegationV2({ ...delegation, kind, rejectionReason }),
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
    mockGetNotificationRecipients.mockResolvedValue(users);

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
