/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  archivingScope,
  delegationKind,
  delegationState,
  DescriptorId,
  descriptorState,
  EServiceArchivingRequestCanceledByDelegateV2,
  EServiceDescriptorArchivingRequestCanceledByDelegateV2,
  EServiceEventV2,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import {
  activeProducerDelegationNotFound,
  inAppTemplates,
  getNotificationRecipients,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handleEserviceArchivingRequestCanceledToDelegate } from "../src/handlers/eservices/handleEserviceArchivingRequestCanceledToDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingRequestCanceledToDelegate", () => {
  const delegatorTenant = getMockTenant();
  const delegateTenant = getMockTenant();
  const userId = generateId<UserId>();

  const descriptorId = generateId<DescriptorId>();
  const descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: descriptorId,
    version: "3",
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
      gracePeriodDays: 60 as const,
    },
  };

  const eservice = {
    ...getMockEService(generateId<EServiceId>(), delegatorTenant.id),
    name: "Test E-service",
    descriptors: [descriptor],
  };

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegatorId: delegatorTenant.id,
    delegateId: delegateTenant.id,
    eserviceId: eservice.id,
    state: delegationState.active,
  });

  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: delegateTenant.id },
    ]);
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    await addOneDelegation(delegation);
    await addOneEService(eservice);
  });

  describe("EServiceArchivingRequestCanceledByDelegateV2", async () => {
    it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceArchivingRequestCanceledByDelegate",
        data: {
          eservice: undefined,
        } satisfies EServiceArchivingRequestCanceledByDelegateV2,
      };
      await expect(() =>
        handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError(
          "eservice",
          "EServiceArchivingRequestCanceledByDelegate"
        )
      );
    });

    it("throws activeProducerDelegationNotFound when no active delegation exists", async () => {
      const eserviceWithoutDelegation = {
        ...eservice,
        id: generateId<EServiceId>(),
        descriptors: [{ ...descriptor, id: generateId<DescriptorId>() }],
      };
      await addOneEService(eserviceWithoutDelegation);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eserviceWithoutDelegation),
        } satisfies EServiceArchivingRequestCanceledByDelegateV2,
      };

      await expect(() =>
        handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
      );
    });

    it("returns empty array when no users have notifications enabled", async () => {
      mockGetNotificationRecipients.mockResolvedValue([]);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eservice),
        } satisfies EServiceArchivingRequestCanceledByDelegateV2,
      };

      const notifications =
        await handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        );

      expect(notifications).toEqual([]);
    });

    it("emits a notification for EServiceArchivingRequestCanceledByDelegate", async () => {
      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eservice),
        } satisfies EServiceArchivingRequestCanceledByDelegateV2,
      };

      const notifications =
        await handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toEqual({
        userId,
        tenantId: delegateTenant.id,
        notificationType: "eserviceArchivingRequestedToDelegator",
        entityId: `${eservice.id}/${descriptorId}`,
        body: inAppTemplates.eserviceArchivingRequestCanceledToDelegate(
          delegatorTenant.name,
          eservice.name
        ),
      });
    });

    it("emits one notification per recipient (multiple users)", async () => {
      const users = [
        { userId: generateId<UserId>(), tenantId: delegateTenant.id },
        { userId: generateId<UserId>(), tenantId: delegateTenant.id },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eservice),
        } satisfies EServiceArchivingRequestCanceledByDelegateV2,
      };

      const notifications =
        await handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(users.length);
      const returnedUserIds = notifications.map((n) => n.userId);
      expect(returnedUserIds).toContain(users[0].userId);
      expect(returnedUserIds).toContain(users[1].userId);
    });
  });

  describe("EServiceDescriptorArchivingRequestCanceledByDelegate", async () => {
    it("emits a notification for EServiceDescriptorArchivingRequestCanceledByDelegate", async () => {
      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: descriptorId,
        } satisfies EServiceDescriptorArchivingRequestCanceledByDelegateV2,
      };

      const notifications =
        await handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toEqual({
        userId,
        tenantId: delegateTenant.id,
        notificationType: "eserviceArchivingRequestedToDelegator",
        entityId: `${eservice.id}/${descriptorId}`,
        body: inAppTemplates.eserviceDescriptorArchivingRequestCanceledToDelegate(
          delegatorTenant.name,
          eservice.name,
          descriptor.version
        ),
      });
    });

    it("throws activeProducerDelegationNotFound when no active delegation exists", async () => {
      const eserviceWithoutDelegation = {
        ...eservice,
        id: generateId<EServiceId>(),
        descriptors: [{ ...descriptor, id: generateId<DescriptorId>() }],
      };
      await addOneEService(eserviceWithoutDelegation);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eserviceWithoutDelegation),
          descriptorId: eserviceWithoutDelegation.descriptors[0].id,
        } satisfies EServiceDescriptorArchivingRequestCanceledByDelegateV2,
      };

      await expect(() =>
        handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
      );
    });

    it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorArchivingRequestCanceledByDelegate",
        data: {
          eservice: undefined,
          descriptorId: descriptorId,
        } satisfies EServiceDescriptorArchivingRequestCanceledByDelegateV2,
      };
      await expect(() =>
        handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        )
      ).rejects.toThrow(
        missingKafkaMessageDataError(
          "eservice",
          "EServiceDescriptorArchivingRequestCanceledByDelegate"
        )
      );
    });

    it("emits one notification per recipient (multiple users)", async () => {
      const users = [
        { userId: generateId<UserId>(), tenantId: delegateTenant.id },
        { userId: generateId<UserId>(), tenantId: delegateTenant.id },
      ];
      mockGetNotificationRecipients.mockResolvedValue(users);

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorArchivingRequestCanceledByDelegate",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: descriptorId,
        } satisfies EServiceDescriptorArchivingRequestCanceledByDelegateV2,
      };

      const notifications =
        await handleEserviceArchivingRequestCanceledToDelegate(
          msg,
          logger,
          readModelService
        );

      expect(notifications).toHaveLength(users.length);
      const returnedUserIds = notifications.map((n) => n.userId);
      expect(returnedUserIds).toContain(users[0].userId);
      expect(returnedUserIds).toContain(users[1].userId);
    });
  });
});
