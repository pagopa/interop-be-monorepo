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
      gracePeriodDays: 30, // This value will be updated in subsequent PRs.
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
        archivingDescriptor.archivingSchedule!.archivableOn
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
        archivingDescriptor.archivingSchedule!.archivableOn
      )
    );
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
