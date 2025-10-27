/* eslint-disable sonarjs/no-identical-functions */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { handleEserviceNewVersionApprovedRejectedToDelegate } from "../src/handlers/eservices/handleEserviceNewVersionApprovedRejectedToDelegate.js";
import { addOneDelegation, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceNewVersionApprovedRejectedToDelegate", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();

  const eservice = getMockEService(generateId<EServiceId>(), delegator.id, [
    getMockDescriptorPublished(),
  ]);
  const descriptorId = eservice.descriptors[0].id;

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId: eservice.id,
    state: delegationState.active,
  });

  const { logger } = getMockContext({});

  beforeEach(async () => {
    // Setup test data
    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneDelegation(delegation);
  });

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceNewVersionApprovedRejectedToDelegate(
        undefined,
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorApprovedByDelegator"
      )
    );
  });

  it("should throw activeProducerDelegationNotFound when no delegation exists for that eservice", async () => {
    const eserviceWithoutDelegation = {
      ...eservice,
      id: generateId<EServiceId>(),
    };

    await expect(() =>
      handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eserviceWithoutDelegation),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
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
      handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eservice),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
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
      handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eservice),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
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
        handleEserviceNewVersionApprovedRejectedToDelegate(
          toEServiceV2(eservice),
          descriptorId,
          logger,
          readModelService,
          "EServiceDescriptorApprovedByDelegator"
        )
      ).rejects.toThrow(activeProducerDelegationNotFound(eservice.id));
    }
  );

  it("should throw tenantNotFound when delegator tenant is not found", async () => {
    const unknownTenantId = generateId<TenantId>();
    const delegationWithUnknownDelegator: Delegation = {
      ...delegation,
      delegatorId: unknownTenantId,
    };
    const eserviceWithUnknownDelegator = {
      ...eservice,
      producerId: unknownTenantId,
    };
    await addOneDelegation(delegationWithUnknownDelegator);

    // Mock notification service to return users (so the check doesn't exit early)
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([{ userId: generateId(), tenantId: delegate.id }]);

    await expect(() =>
      handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eserviceWithUnknownDelegator),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
      )
    ).rejects.toThrow(tenantNotFound(unknownTenantId));
  });

  it("should return empty array when no users have notifications enabled", async () => {
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const notifications =
      await handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eservice),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
      );

    expect(notifications).toEqual([]);
  });

  it.each<{
    eventType:
      | "EServiceDescriptorApprovedByDelegator"
      | "EServiceDescriptorRejectedByDelegator";
    expectedBody: string;
  }>([
    {
      eventType: "EServiceDescriptorApprovedByDelegator",
      expectedBody: `L'ente delegante ${delegator.name} ha approvato la pubblicazione della nuova versione dell'e-service <strong>${eservice.name}</strong> che gestisci tramite delega.`,
    },
    {
      eventType: "EServiceDescriptorRejectedByDelegator",
      expectedBody: `L'ente delegante ${delegator.name} ha rifiutato la pubblicazione della nuova versione dell'e-service <strong>${eservice.name}</strong> che gestisci tramite delega.`,
    },
  ])(
    "should handle $eventType event correctly",
    async ({ eventType, expectedBody }) => {
      const delegateUsers = [
        { userId: generateId(), tenantId: delegator.id },
        { userId: generateId(), tenantId: delegator.id },
      ];

      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(delegateUsers);

      const notifications =
        await handleEserviceNewVersionApprovedRejectedToDelegate(
          toEServiceV2(eservice),
          descriptorId,
          logger,
          readModelService,
          eventType
        );

      expect(notifications).toHaveLength(delegateUsers.length);

      const expectedNotifications = delegateUsers.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: expectedBody,
        notificationType: "eserviceNewVersionApprovedRejectedToDelegate",
        entityId: `${eservice.id}/${descriptorId}`,
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

    const notifications =
      await handleEserviceNewVersionApprovedRejectedToDelegate(
        toEServiceV2(eservice),
        descriptorId,
        logger,
        readModelService,
        "EServiceDescriptorApprovedByDelegator"
      );

    expect(notifications).toHaveLength(3);

    // Check that all users got notifications
    const userIds = notifications.map((n) => n.userId);
    expect(userIds).toContain(users[0].userId);
    expect(userIds).toContain(users[1].userId);
    expect(userIds).toContain(users[2].userId);
  });

  const latestDate = new Date();
  const olderDate = new Date(latestDate);
  olderDate.setDate(olderDate.getDate() - 1);
});
