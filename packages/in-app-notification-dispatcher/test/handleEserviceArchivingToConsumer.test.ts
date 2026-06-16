import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  archivingScope,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceDescriptorArchivedV2,
  EServiceArchivingScheduledV2,
  EServiceArchivingCompletedV2,
  EServiceDescriptorArchivingScheduledV2,
  EServiceDescriptorArchivingCompletedV2,
  EServiceEventV2,
  EServiceIdDescriptorId,
  generateId,
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { handleEserviceArchivingToConsumer } from "../src/handlers/eservices/handleEserviceArchivingToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingToConsumer", () => {
  const producerTenant = getMockTenant();
  const consumerTenant = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const archivingDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: producerTenant.id,
    descriptors: [archivingDescriptor],
  };

  const agreement = {
    ...getMockAgreement(eservice.id, consumerTenant.id, agreementState.active),
  };

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: consumerTenant.id },
    ]);
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    await addOneAgreement(agreement);
  });

  it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: undefined,
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingScheduledV2,
    };
    await expect(() =>
      handleEserviceArchivingToConsumer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingScheduled"
      )
    );
  });

  it("emits a notification for EServiceDescriptorArchivingScheduled to active consumers", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingScheduledV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: consumerTenant.id,
      notificationType: "eserviceStateChangedToConsumer",
      entityId: EServiceIdDescriptorId.parse(
        `${eservice.id}/${archivingDescriptor.id}`
      ),
      body: inAppTemplates.eserviceArchivingStartedDescriptorToConsumer(
        eservice.name,
        archivingDescriptor.version,
        producerTenant.name,
        archivingDescriptor.archivingSchedule!.archivableOn
      ),
    });
  });

  it("emits a notification for EServiceArchivingScheduled (eservice scope)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingScheduled",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingScheduledV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingStartedEserviceToConsumer(
        eservice.name,
        producerTenant.name,
        archivingDescriptor.archivingSchedule!.archivableOn
      )
    );
  });

  it("emits a notification for EServiceDescriptorArchivingCompleted (descriptor scope)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingCompleted",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingCompletedV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingCompletedDescriptorToConsumer(
        eservice.name,
        archivingDescriptor.version,
        producerTenant.name
      )
    );
  });

  it("emits a notification for EServiceArchivingCompleted (eservice scope)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingCompleted",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingCompletedV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingCompletedEserviceToConsumer(
        eservice.name,
        producerTenant.name
      )
    );
  });

  it("emits early-archived notification to consumers whose agreements are now archived", async () => {
    // Same eservice but the consumer's agreement is in 'archived' state — that's
    // exactly the scenario that triggers an early archive (subscriptions exhausted).
    const archivedAgreement = getMockAgreement(
      eservice.id,
      consumerTenant.id,
      agreementState.archived
    );
    await addOneAgreement(archivedAgreement);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchived",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivedV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    // Includes both the active agreement consumer and the archived one (deduped by tenant in real flow, but here it's the same tenant)
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingDescriptorArchivedToConsumer(
        eservice.name,
        archivingDescriptor.version,
        producerTenant.name
      )
    );
  });

  it("returns empty array (skip routine) when archivingSchedule is absent on EServiceDescriptorArchived", async () => {
    const routineDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
    };
    const routineEservice: EService = {
      ...eservice,
      id: generateId(),
      descriptors: [routineDescriptor],
    };
    await addOneEService(routineEservice);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchived",
      data: {
        eservice: toEServiceV2(routineEservice),
        descriptorId: routineDescriptor.id,
      } satisfies EServiceDescriptorArchivedV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });

  it("returns empty array when there are no agreements", async () => {
    const otherDescriptor: Descriptor = {
      ...archivingDescriptor,
      id: generateId<DescriptorId>(),
    };
    const otherEservice: EService = {
      ...getMockEService(),
      producerId: producerTenant.id,
      descriptors: [otherDescriptor],
    };
    await addOneEService(otherEservice);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: toEServiceV2(otherEservice),
        descriptorId: otherDescriptor.id,
      } satisfies EServiceDescriptorArchivingScheduledV2,
    };
    const notifications = await handleEserviceArchivingToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });
});
