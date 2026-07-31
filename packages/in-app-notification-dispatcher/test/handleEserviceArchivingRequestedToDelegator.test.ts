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
  EServiceArchivingRequestedByDelegateV2,
  EServiceDescriptorArchivingRequestedByDelegateV2,
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

import { handleEserviceArchivingRequestedToDelegator } from "../src/handlers/eservices/handleEserviceArchivingRequestedToDelegator.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingRequestedToDelegator", () => {
  const delegatorTenant = getMockTenant();
  const delegateTenant = getMockTenant();
  const userId = generateId<UserId>();

  const archivingDescriptorId = generateId<DescriptorId>();
  const archivingDescriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorId,
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
    descriptors: [archivingDescriptor],
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
      { userId, tenantId: delegatorTenant.id },
    ]);
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    await addOneDelegation(delegation);
    await addOneEService(eservice);
  });

  // ── EServiceDescriptorArchivingRequestedByDelegate ────────────────────────

  it("throws missingKafkaMessageDataError when eservice is undefined (descriptor event)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        eservice: undefined,
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };
    await expect(() =>
      handleEserviceArchivingRequestedToDelegator(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingRequestedByDelegate"
      )
    );
  });

  it("throws activeProducerDelegationNotFound when no active delegation exists (descriptor event)", async () => {
    const eserviceWithoutDelegation = {
      ...eservice,
      id: generateId<EServiceId>(),
      descriptors: [{ ...archivingDescriptor, id: generateId<DescriptorId>() }],
    };
    await addOneEService(eserviceWithoutDelegation);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eserviceWithoutDelegation),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };

    await expect(() =>
      handleEserviceArchivingRequestedToDelegator(msg, logger, readModelService)
    ).rejects.toThrow(
      activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
    );
  });

  it("returns empty array when no users have notifications enabled (descriptor event)", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };

    const notifications = await handleEserviceArchivingRequestedToDelegator(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("emits a notification for EServiceDescriptorArchivingRequestedByDelegate", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };

    const notifications = await handleEserviceArchivingRequestedToDelegator(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegatorTenant.id,
      notificationType: "eserviceArchivingRequestedToDelegator",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceDescriptorArchivingRequestedByDelegateToDelegator(
        delegateTenant.name,
        archivingDescriptor.version,
        eservice.name
      ),
    });
  });

  // ── EServiceArchivingRequestedByDelegate ─────────────────────────────────

  it("throws missingKafkaMessageDataError when eservice is undefined (eservice event)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: undefined,
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };
    await expect(() =>
      handleEserviceArchivingRequestedToDelegator(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceArchivingRequestedByDelegate"
      )
    );
  });

  it("throws activeProducerDelegationNotFound when no active delegation exists (eservice event)", async () => {
    const eserviceWithoutDelegation = {
      ...eservice,
      id: generateId<EServiceId>(),
      descriptors: [{ ...archivingDescriptor, id: generateId<DescriptorId>() }],
    };
    await addOneEService(eserviceWithoutDelegation);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eserviceWithoutDelegation),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    await expect(() =>
      handleEserviceArchivingRequestedToDelegator(msg, logger, readModelService)
    ).rejects.toThrow(
      activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
    );
  });

  it("returns empty array when no users have notifications enabled (eservice event)", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    const notifications = await handleEserviceArchivingRequestedToDelegator(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("emits a notification for EServiceArchivingRequestedByDelegate", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    const notifications = await handleEserviceArchivingRequestedToDelegator(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegatorTenant.id,
      notificationType: "eserviceArchivingRequestedToDelegator",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceArchivingRequestedByDelegateToDelegator(
        delegateTenant.name,
        eservice.name
      ),
    });
  });

  it("emits one notification per recipient (multiple users)", async () => {
    const users = [
      { userId: generateId<UserId>(), tenantId: delegatorTenant.id },
      { userId: generateId<UserId>(), tenantId: delegatorTenant.id },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    const notifications = await handleEserviceArchivingRequestedToDelegator(
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
