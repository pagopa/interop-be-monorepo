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
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handleEserviceArchivingCanceledToProducer } from "../src/handlers/eservices/handleEserviceArchivingCanceledToProducer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleEserviceArchivingCanceledToProducer", () => {
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

  it("emits a notification for EServiceDescriptorArchivingCanceled (descriptor scope)", async () => {
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
  });

  it("emits a notification for EServiceArchivingCanceled (eservice scope)", async () => {
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
      inAppTemplates.eserviceArchivingCanceledEserviceToProducer(eservice.name)
    );
  });

  it("returns empty when there are no recipients for the producer", async () => {
    mockGetNotificationRecipients.mockResolvedValueOnce([]);
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
