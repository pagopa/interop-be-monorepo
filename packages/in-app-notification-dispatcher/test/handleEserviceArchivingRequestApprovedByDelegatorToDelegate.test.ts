import { dateAtRomeZone } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EService,
  EServiceArchivingRequestApprovedByDelegatorV2,
  EServiceArchivingRequestRejectedByDelegatorV2,
  EServiceEventV2,
  UserId,
  archivingScope,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  gracePeriodDays,
  missingKafkaMessageDataError,
  toEServiceV2,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
} from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handleEserviceArchivingRequestApprovedRejectedToDelegate } from "../src/handlers/eservices/handleEserviceArchivingRequestApprovedRejectedToDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingRequestApprovedRejectedToDelegate", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.eservice,
      gracePeriodDays: gracePeriodDays[0],
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: delegator.id,
    descriptors: [descriptor],
  };

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId: eservice.id,
    state: delegationState.active,
  });

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: delegate.id },
    ]);
    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
  });

  it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
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

  it("returns empty array when no recipients have notification enabled", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestApprovedByDelegatorV2,
    };
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("emits notification to delegate for approved archiving request", async () => {
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
    const expectedDate = dateAtRomeZone(
      descriptor.archivingSchedule!.archivableOn
    );

    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegate.id,
      body: `${delegator.name} ha confermato la tua richiesta di archiviazione dell'e-service ${eservice.name}. L'archiviazione avverrà il giorno ${expectedDate}.`,
      notificationType: "eserviceArchivingRequestApprovedRejectedToDelegate",
      entityId: delegation.id,
    });
  });

  it("emits notification to delegate for rejected archiving request", async () => {
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
      tenantId: delegate.id,
      body: `${delegator.name} ha rifiutato la tua richiesta di archiviazione dell'e-service ${eservice.name}.`,
      notificationType: "eserviceArchivingRequestApprovedRejectedToDelegate",
      entityId: delegation.id,
    });
  });
});
