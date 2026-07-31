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
  EServiceArchivingRequestApprovedByDelegatorV2,
  EServiceArchivingRequestRejectedByDelegatorV2,
  EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
  EServiceDescriptorArchivingRequestRejectedByDelegatorV2,
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

import { handleEserviceArchivingRequestApprovedRejectedToDelegate } from "../src/handlers/eservices/handleEserviceArchivingRequestApprovedRejectedToDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingRequestApprovedRejectedToDelegate", () => {
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
      { userId, tenantId: delegateTenant.id },
    ]);
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    await addOneDelegation(delegation);
    await addOneEService(eservice);
  });

  // ── EServiceDescriptorArchivingRequestApprovedByDelegator ─────────────────

  it("throws missingKafkaMessageDataError when eservice is undefined (descriptor approved)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      data: {
        eservice: undefined,
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
    };
    await expect(() =>
      handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingRequestApprovedByDelegator"
      )
    );
  });

  it("throws activeProducerDelegationNotFound when no active delegation exists (descriptor approved)", async () => {
    const eserviceWithoutDelegation = {
      ...eservice,
      id: generateId<EServiceId>(),
      descriptors: [{ ...archivingDescriptor, id: generateId<DescriptorId>() }],
    };
    await addOneEService(eserviceWithoutDelegation);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eserviceWithoutDelegation),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
    };

    await expect(() =>
      handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      activeProducerDelegationNotFound(eserviceWithoutDelegation.id)
    );
  });

  it("returns empty array when no users have notifications enabled (descriptor approved)", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("emits a notification for EServiceDescriptorArchivingRequestApprovedByDelegator", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegateTenant.id,
      notificationType: "eserviceArchivingApprovedRejectedToDelegate",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceDescriptorArchivingRequestApprovedByDelegatorToDelegate(
        delegatorTenant.name,
        archivingDescriptor.version,
        eservice.name,
        archivingDescriptor.archivingSchedule!.archivableOn
      ),
    });
  });

  // ── EServiceDescriptorArchivingRequestRejectedByDelegator ─────────────────

  it("emits a notification for EServiceDescriptorArchivingRequestRejectedByDelegator", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestRejectedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
      } satisfies EServiceDescriptorArchivingRequestRejectedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegateTenant.id,
      notificationType: "eserviceArchivingApprovedRejectedToDelegate",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceDescriptorArchivingRequestRejectedByDelegatorToDelegate(
        delegatorTenant.name,
        archivingDescriptor.version,
        eservice.name
      ),
    });
  });

  // ── EServiceArchivingRequestApprovedByDelegator ───────────────────────────

  it("throws missingKafkaMessageDataError when eservice is undefined (eservice approved)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestApprovedByDelegator",
      data: {
        eservice: undefined,
      } satisfies EServiceArchivingRequestApprovedByDelegatorV2,
    };
    await expect(() =>
      handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceArchivingRequestApprovedByDelegator"
      )
    );
  });

  it("emits a notification for EServiceArchivingRequestApprovedByDelegator", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestApprovedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegateTenant.id,
      notificationType: "eserviceArchivingApprovedRejectedToDelegate",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceArchivingRequestApprovedByDelegatorToDelegate(
        delegatorTenant.name,
        eservice.name,
        archivingDescriptor.archivingSchedule!.archivableOn
      ),
    });
  });

  // ── EServiceArchivingRequestRejectedByDelegator ───────────────────────────

  it("emits a notification for EServiceArchivingRequestRejectedByDelegator", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestRejectedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestRejectedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegateTenant.id,
      notificationType: "eserviceArchivingApprovedRejectedToDelegate",
      entityId: `${eservice.id}/${archivingDescriptorId}`,
      body: inAppTemplates.eserviceArchivingRequestRejectedByDelegatorToDelegate(
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
      type: "EServiceArchivingRequestRejectedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestRejectedByDelegatorV2,
    };

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
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
