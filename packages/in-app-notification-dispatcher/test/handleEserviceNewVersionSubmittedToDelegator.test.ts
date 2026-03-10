/* eslint-disable sonarjs/no-identical-functions */
import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockTenant,
  getMockDelegation,
  getMockEService,
  getMockDescriptorPublished,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  delegationKind,
  EServiceId,
  toEServiceV2,
  Delegation,
  DelegationState,
  delegationState,
} from "pagopa-interop-models";
import {
  activeProducerDelegationNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handleEserviceNewVersionSubmittedToDelegator } from "../src/handlers/eservices/handleEserviceNewVersionSubmittedToDelegator.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import { addOneDelegation, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceNewVersionSubmittedToDelegator", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();

  const eservice = getMockEService(generateId<EServiceId>(), delegator.id, [
    getMockDescriptorPublished(),
  ]);

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId: eservice.id,
    state: delegationState.active,
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

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceNewVersionSubmittedToDelegator(
        undefined,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorSubmittedByDelegate"
      )
    );
  });

  it("should throw activeProducerDelegationNotFound when no delegation exists for that eservice", async () => {
    const eserviceWithoutDelegation = {
      ...eservice,
      id: generateId<EServiceId>(),
    };

    await expect(() =>
      handleEserviceNewVersionSubmittedToDelegator(
        toEServiceV2(eserviceWithoutDelegation),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
    );
  });

  it("should throw activeProducerDelegationNotFound when the delegator is not the producer", async () => {
    const delegationNotByProducer: Delegation = {
      ...delegation,
      delegatorId: generateId(),
    };
    await addOneDelegation(delegationNotByProducer);

    await expect(() =>
      handleEserviceNewVersionSubmittedToDelegator(
        toEServiceV2(eservice),
        logger,
        readModelService
      )
    ).rejects.toThrow(activeProducerDelegationNotFound(eservice.id));
  });

  it("should throw activeProducerDelegationNotFound when the delegation is not a producer delegation", async () => {
    const consumerDelegation: Delegation = {
      ...delegation,
      kind: delegationKind.delegatedConsumer,
    };
    await addOneDelegation(consumerDelegation);

    await expect(() =>
      handleEserviceNewVersionSubmittedToDelegator(
        toEServiceV2(eservice),
        logger,
        readModelService
      )
    ).rejects.toThrow(activeProducerDelegationNotFound(eservice.id));
  });

  it.each<DelegationState>([
    delegationState.waitingForApproval,
    delegationState.rejected,
    delegationState.revoked,
  ])(
    "should throw activeProducerDelegationNotFound when the delegation is %s",
    async (delegationState) => {
      const notActiveDelegation: Delegation = {
        ...delegation,
        state: delegationState,
      };
      await addOneDelegation(notActiveDelegation);

      await expect(() =>
        handleEserviceNewVersionSubmittedToDelegator(
          toEServiceV2(eservice),
          logger,
          readModelService
        )
      ).rejects.toThrow(activeProducerDelegationNotFound(eservice.id));
    }
  );

  it("should throw tenantNotFound when delegate tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const delegationWithUnknownDelegate: Delegation = {
      ...delegation,
      delegateId: unknownTenantId,
    };
    await addOneDelegation(delegationWithUnknownDelegate);

    // Mock notification recipients so the check doesn't exit early
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: generateId(), tenantId: delegator.id },
    ]);

    await expect(() =>
      handleEserviceNewVersionSubmittedToDelegator(
        toEServiceV2(eservice),
        logger,
        readModelService
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleEserviceNewVersionSubmittedToDelegator(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should handle EServiceDescriptorSubmittedByDelegate event correctly", async () => {
    const delegateUsers = [
      { userId: generateId(), tenantId: delegator.id },
      { userId: generateId(), tenantId: delegator.id },
    ];

    mockGetNotificationRecipients.mockResolvedValue(delegateUsers);

    const notifications = await handleEserviceNewVersionSubmittedToDelegator(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(delegateUsers.length);

    const expectedNotifications = delegateUsers.map((user) => ({
      userId: user.userId,
      tenantId: user.tenantId,
      body: inAppTemplates.eserviceNewVersionSubmittedToDelegator(
        delegate.name,
        eservice.name
      ),
      notificationType: "eserviceNewVersionSubmittedToDelegator",
      entityId: delegation.id,
    }));

    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });

  it("should generate notifications for multiple users", async () => {
    const users = [
      { userId: generateId(), tenantId: delegator.id },
      { userId: generateId(), tenantId: delegator.id },
      { userId: generateId(), tenantId: delegator.id },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleEserviceNewVersionSubmittedToDelegator(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });
});
