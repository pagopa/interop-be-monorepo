import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
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
      { userId, tenantId: consumerTenant.id },
    ]);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
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
      handleEserviceArchivingToConsumer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingScheduled"
      )
    );
  });

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceDescriptorArchivingScheduled to active consumers (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        producerId: producerTenant.id,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);
      await addOneAgreement({
        ...getMockAgreement(
          eservice.id,
          consumerTenant.id,
          agreementState.active
        ),
      });

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
      await addOneAgreement({
        ...getMockAgreement(
          eservice.id,
          consumerTenant.id,
          agreementState.active
        ),
      });

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
          archivingDescriptor.archivingSchedule!.archivableOn
        )
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
      await addOneAgreement({
        ...getMockAgreement(
          eservice.id,
          consumerTenant.id,
          agreementState.active
        ),
      });

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
      await addOneAgreement({
        ...getMockAgreement(
          eservice.id,
          consumerTenant.id,
          agreementState.active
        ),
      });

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
          archivingDescriptor.archivingSchedule!.archivableOn
        )
      );
    }
  );

  it("returns empty array when there are no agreements", async () => {
    const otherDescriptor: Descriptor = {
      ...getArchivingDescriptor(30),
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
