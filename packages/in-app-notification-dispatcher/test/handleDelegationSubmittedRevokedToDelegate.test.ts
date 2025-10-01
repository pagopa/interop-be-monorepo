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
import { handleDelegationSubmittedRevokedToDelegate } from "../src/handlers/delegations/handleDelegationSubmittedRevokedToDelegate.js";
import {
  addOneDelegation,
  addOneTenant,
  mockUserServiceSQL,
  readModelService,
} from "./utils.js";

describe("handleDelegationSubmittedRevokedToDelegate", () => {
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
      handleDelegationSubmittedRevokedToDelegate(
        undefined,
        logger,
        readModelService,
        mockUserServiceSQL,
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

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: delegate.id },
    ]);

    await expect(() =>
      handleDelegationSubmittedRevokedToDelegate(
        toDelegationV2(delegationWithUnknownDelegator),
        logger,
        readModelService,
        mockUserServiceSQL,
        "ProducerDelegationSubmitted"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleDelegationSubmittedRevokedToDelegate(
      toDelegationV2(delegation),
      logger,
      readModelService,
      mockUserServiceSQL,
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
      expectedBody: `${delegator.name} ha conferito una delega in erogazione.`,
    },
    {
      eventType: "ConsumerDelegationSubmitted",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `${delegator.name} ha conferito una delega in fruizione.`,
    },
    {
      eventType: "ProducerDelegationRevoked",
      kind: delegationKind.delegatedProducer,
      expectedBody: `${delegator.name} ha revocato una delega in erogazione.`,
    },
    {
      eventType: "ConsumerDelegationRevoked",
      kind: delegationKind.delegatedConsumer,
      expectedBody: `${delegator.name} ha revocato una delega in fruizione.`,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, kind, expectedBody }) => {
      const delegateUsers = [
        { userId: generateId(), tenantId: delegate.id },
        { userId: generateId(), tenantId: delegate.id },
      ];

      mockGetNotificationRecipients.mockResolvedValue(delegateUsers);

      const notifications = await handleDelegationSubmittedRevokedToDelegate(
        toDelegationV2({ ...delegation, kind }),
        logger,
        readModelService,
        mockUserServiceSQL,
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
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleDelegationSubmittedRevokedToDelegate(
      toDelegationV2(delegation),
      logger,
      readModelService,
      mockUserServiceSQL,
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
