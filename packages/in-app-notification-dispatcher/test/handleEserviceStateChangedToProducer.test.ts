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
  EServiceEventV2,
  EServiceIdDescriptorId,
  generateId,
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorActivatedV2,
} from "pagopa-interop-models";
import { archivingScope } from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { handleEserviceStateChangedToProducer } from "../src/handlers/eservices/handleEserviceStateChangedToProducer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceStateChangedToProducer", () => {
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
      type: "EServiceDescriptorSuspended",
      data: {
        eservice: undefined,
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorSuspendedV2,
    };
    await expect(() =>
      handleEserviceStateChangedToProducer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorSuspended")
    );
  });

  it("emits a notification for EServiceDescriptorSuspended", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorSuspended",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorSuspendedV2,
    };
    const notifications = await handleEserviceStateChangedToProducer(
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
      body: inAppTemplates.eserviceArchivingDescriptorSuspendedToProducer(
        eservice.name,
        archivingDescriptor.version,
        archivingDescriptor.archivingSchedule!.archivableOn
      ),
    });
  });

  it("emits a notification for EServiceDescriptorActivated", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorActivated",
      data: {
        descriptorId: archivingDescriptor.id,
        eservice: toEServiceV2(eservice),
      } satisfies EServiceDescriptorActivatedV2,
    };
    const notifications = await handleEserviceStateChangedToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingDescriptorActivatedToProducer(
        eservice.name,
        archivingDescriptor.version,
        archivingDescriptor.archivingSchedule!.archivableOn
      )
    );
    expect(notifications[0].notificationType).toBe(
      "eserviceStateChangedToProducer"
    );
  });

  it("emits no notification when archivingSchedule is absent on EServiceDescriptorSuspended", async () => {
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
      type: "EServiceDescriptorSuspended",
      data: {
        eservice: toEServiceV2(routineEservice),
        descriptorId: routineDescriptor.id,
      } satisfies EServiceDescriptorSuspendedV2,
    };
    const notifications = await handleEserviceStateChangedToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(0);
  });

  it("emits no notification when archivingSchedule is absent on EServiceDescriptorActivated", async () => {
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
      type: "EServiceDescriptorActivated",
      data: {
        eservice: toEServiceV2(routineEservice),
        descriptorId: routineDescriptor.id,
      } satisfies EServiceDescriptorActivatedV2,
    };
    const notifications = await handleEserviceStateChangedToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(0);
  });

  it("returns empty when there are no recipients for the producer", async () => {
    mockGetNotificationRecipients.mockResolvedValueOnce([]);
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorSuspended",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorSuspendedV2,
    };
    const notifications = await handleEserviceStateChangedToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });
});
