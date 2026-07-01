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
import { handleEserviceArchivingCanceledToConsumer } from "../src/handlers/eservices/handleEserviceArchivingCanceledToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingCanceledToConsumer", () => {
  const producerTenant = getMockTenant();
  const consumerTenant = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: producerTenant.id,
    descriptors: [descriptor],
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
      type: "EServiceArchivingCanceled",
      data: {
        eservice: undefined,
      } satisfies EServiceArchivingCanceledV2,
    };
    await expect(() =>
      handleEserviceArchivingCanceledToConsumer(msg, logger, readModelService)
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
        descriptorId: descriptor.id,
      } satisfies EServiceDescriptorArchivingCanceledV2,
    };
    const notifications = await handleEserviceArchivingCanceledToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: consumerTenant.id,
      notificationType: "eserviceStateChangedToConsumer",
      entityId: EServiceIdDescriptorId.parse(`${eservice.id}/${descriptor.id}`),
      body: inAppTemplates.eserviceArchivingCanceledDescriptorToConsumer(
        eservice.name,
        descriptor.version
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
    const notifications = await handleEserviceArchivingCanceledToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toBe(
      inAppTemplates.eserviceArchivingCanceledEserviceToConsumer(eservice.name)
    );
  });

  it("returns no notifications when there are no agreements", async () => {
    const otherEservice: EService = {
      ...getMockEService(),
      producerId: producerTenant.id,
      descriptors: [getMockDescriptor(descriptorState.published)],
    };
    await addOneEService(otherEservice);
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingCanceled",
      data: {
        eservice: toEServiceV2(otherEservice),
      } satisfies EServiceArchivingCanceledV2,
    };
    const notifications = await handleEserviceArchivingCanceledToConsumer(
      msg,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(0);
  });
});
