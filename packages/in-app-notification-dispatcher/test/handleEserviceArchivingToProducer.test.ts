import {
  getMockContext,
  getMockEService,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
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
  GracePeriodDays,
  gracePeriodDays,
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import { archivingScope } from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handleEserviceArchivingToProducer } from "../src/handlers/eservices/handleEserviceArchivingToProducer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceArchivingToProducer", () => {
  const producerTenant = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const archivingDescriptorId = generateId<DescriptorId>();
  const getArchivingDescriptor = (
    gracePeriodDaysValue: GracePeriodDays
  ): Descriptor => ({
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorId,
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
      gracePeriodDays: gracePeriodDaysValue,
    },
  });

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: producerTenant.id },
    ]);
    await addOneTenant(producerTenant);
  });

  it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingScheduled",
      data: {
        eservice: undefined,
        descriptorId: archivingDescriptorId,
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

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceDescriptorArchivingScheduled (descriptor scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

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
    }
  );

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceArchivingScheduled (eservice scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

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
    }
  );

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceDescriptorArchivingCompleted (descriptor scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

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
          archivingDescriptor.version,
          archivingDescriptor.archivingSchedule!.archivableOn
        )
      );
    }
  );

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceArchivingCompleted (eservice scope, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

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
        inAppTemplates.eserviceArchivingCompletedEserviceToProducer(
          eservice.name
        )
      );
    }
  );

  it.each([...gracePeriodDays])(
    "emits an early-archived notification when archivingSchedule is present on EServiceDescriptorArchived (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

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
        inAppTemplates.eserviceArchivingDescriptorArchivedToProducer(
          eservice.name,
          archivingDescriptor.version
        )
      );
    }
  );

  it("emits an archived notification when archivingSchedule is absent on EServiceDescriptorArchived", async () => {
    const routineDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      // no archivingSchedule → auto-archiviation routine path
    };
    const routineEservice: EService = {
      ...getMockEService(),
      producerId: producerTenant.id,
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
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingDescriptorArchivedToProducer(
        routineEservice.name,
        routineDescriptor.version
      )
    );
  });

  it("returns empty when there are no recipients for the producer", async () => {
    mockGetNotificationRecipients.mockResolvedValueOnce([]);
    const archivingDescriptor = getArchivingDescriptor(30);
    const eservice: EService = {
      ...getMockEService(),
      producerId: producerTenant.id,
      descriptors: [archivingDescriptor],
    };
    await addOneEService(eservice);

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
