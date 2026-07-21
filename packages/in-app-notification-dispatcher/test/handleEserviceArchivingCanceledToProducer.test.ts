import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  archivingScope,
  Descriptor,
  descriptorState,
  EService,
  EServiceArchivingCanceledV2,
  EServiceDescriptorArchivingCanceledV2,
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
import { handleEserviceArchivingCanceledToProducer } from "../src/handlers/eservices/handleEserviceArchivingCanceledToProducer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceArchivingCanceledToProducer", () => {
  const producerTenant = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const getArchivingDescriptor = (
    gracePeriodDaysValue: GracePeriodDays
  ): Descriptor => ({
    ...getMockDescriptor(descriptorState.archiving),
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
      type: "EServiceArchivingCanceled",
      data: {
        eservice: undefined,
      } satisfies EServiceArchivingCanceledV2,
    };
    await expect(() =>
      handleEserviceArchivingCanceledToProducer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceArchivingCanceled")
    );
  });

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceDescriptorArchivingCanceled (descriptor scope, gracePeriodDays: %d)",
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
        type: "EServiceDescriptorArchivingCanceled",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: archivingDescriptor.id,
        } satisfies EServiceDescriptorArchivingCanceledV2,
      };
      const notifications = await handleEserviceArchivingCanceledToProducer(
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
        body: inAppTemplates.eserviceArchivingCanceledDescriptorToProducer(
          eservice.name,
          archivingDescriptor.version
        ),
      });
    }
  );

  it.each([...gracePeriodDays])(
    "emits a notification for EServiceArchivingCanceled (eservice scope, gracePeriodDays: %d)",
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
        type: "EServiceArchivingCanceled",
        data: {
          eservice: toEServiceV2(eservice),
        } satisfies EServiceArchivingCanceledV2,
      };
      const notifications = await handleEserviceArchivingCanceledToProducer(
        msg,
        logger,
        readModelService
      );
      expect(notifications).toHaveLength(1);
      expect(notifications[0].body).toBe(
        inAppTemplates.eserviceArchivingCanceledEserviceToProducer(
          eservice.name
        )
      );
    }
  );

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
      type: "EServiceDescriptorArchivingCanceled",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
      } satisfies EServiceDescriptorArchivingCanceledV2,
    };
    const notifications = await handleEserviceArchivingCanceledToProducer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });
});
