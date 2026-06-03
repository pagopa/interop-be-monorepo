import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockEService,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
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
import { archivingScope } from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { handleEserviceArchivingToProducer } from "../src/handlers/eservices/handleEserviceArchivingToProducer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceArchivingToProducer", () => {
  const producerTenant = getMockTenant();
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

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: producerTenant.id },
    ]);
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
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
      handleEserviceArchivingToProducer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingScheduled"
      )
    );
  });

  it("emits a notification for EServiceDescriptorArchivingScheduled (descriptor scope)", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingScheduledV2,
    };
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: producerTenant.id,
      notificationType: "eserviceStateChangedToProducer",
      entityId: EServiceIdDescriptorId.parse(
        `${eservice.id}/${archivingDescriptor.id}`
      ),
      body: inAppTemplates.eserviceArchivingStartedDescriptorToProducer(
        eservice.name,
        archivingDescriptor.version,
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
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingStartedEserviceToProducer(
        eservice.name,
        archivingDescriptor.archivingSchedule!.archivableOn
      )
    );
    expect(notifications[0].notificationType).toBe(
      "eserviceStateChangedToProducer"
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
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingCompletedDescriptorToProducer(
        eservice.name,
        archivingDescriptor.version
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
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingCompletedEserviceToProducer(eservice.name)
    );
  });

  it("emits an early-archived notification when archivingSchedule is present on EServiceDescriptorArchived", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchived",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivedV2,
    };
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingEarlyArchivedToProducer(
        eservice.name,
        archivingDescriptor.version
      )
    );
  });

  it("returns empty array (skip routine) when archivingSchedule is absent on EServiceDescriptorArchived", async () => {
    const routineDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      // no archivingSchedule → auto-archiviation routine path
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
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });

  it("returns empty when there are no recipients for the producer", async () => {
    mockGetNotificationRecipients.mockResolvedValueOnce([]);
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingScheduledV2,
    };
    const notifications = await handleEserviceArchivingToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });
});
