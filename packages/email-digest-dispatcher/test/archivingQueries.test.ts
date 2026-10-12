import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  AgreementState,
  ArchivingSchedule,
  archivingScope,
  descriptorState,
  DescriptorState,
  EService,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  createMockAgreement,
  daysAgo,
  readModelService,
} from "./integrationUtils.js";

/**
 * Days-in-the-future helper, mirroring integrationUtils' daysAgo.
 */
const daysFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * Creates a mock EService with a single descriptor currently in the archiving
 * notice-period countdown.
 */
const createMockEServiceWithScheduledArchiving = (
  producerId: TenantId,
  startedAt: Date,
  archivableOn: Date,
  scope: ArchivingSchedule["scope"] = archivingScope.descriptor
): EService => ({
  ...getMockEService(),
  producerId,
  descriptors: [
    {
      ...getMockDescriptor(),
      version: "3",
      state: descriptorState.archiving,
      archivingSchedule: {
        startedAt,
        archivableOn,
        scope,
        gracePeriodDays: 30,
      },
    },
  ],
});

describe("ReadModelService - getArchivingInProgressEservices", () => {
  it("should return empty array when no e-services exist for the producer", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const results = await readModelService.getArchivingInProgressEservices(
      producer.id
    );

    expect(results).toEqual([]);
  });

  it("should return descriptors currently in the archiving countdown regardless of when it started", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    // Started a long time ago: still counts, this is a snapshot, not a delta.
    const eservice = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(60),
      daysFromNow(30)
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingInProgressEservices(
      producer.id
    );

    expect(results.length).toBe(1);
    expect(results[0].eserviceId).toBe(eservice.id);
    expect(results[0].descriptorId).toBe(eservice.descriptors[0].id);
    expect(results[0].eserviceName).toBe(eservice.name);
    expect(results[0].version).toBe("3");
    expect(results[0].scope).toBe("Descriptor");
    expect(results[0].totalCount).toBe(1);
  });

  it("should reflect the EService scope when the whole e-service is being archived", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const eservice = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(1),
      daysFromNow(30),
      archivingScope.eservice
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingInProgressEservices(
      producer.id
    );

    expect(results.length).toBe(1);
    expect(results[0].scope).toBe("EService");
  });

  it("should order results from most to least recently started", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const older = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(10),
      daysFromNow(30)
    );
    const newer = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(1),
      daysFromNow(30)
    );
    await addOneEService(older);
    await addOneEService(newer);

    const results = await readModelService.getArchivingInProgressEservices(
      producer.id
    );

    expect(results.length).toBe(2);
    expect(results[0].eserviceId).toBe(newer.id);
    expect(results[1].eserviceId).toBe(older.id);
  });

  it("should not return schedules belonging to a different producer", async () => {
    const producer = getMockTenant();
    const otherProducer = getMockTenant();
    await addOneTenant(producer);
    await addOneTenant(otherProducer);

    const eservice = createMockEServiceWithScheduledArchiving(
      otherProducer.id,
      daysAgo(1),
      daysFromNow(30)
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingInProgressEservices(
      producer.id
    );

    expect(results).toEqual([]);
  });
});

describe("ReadModelService - getArchivingImminentEservices", () => {
  it("should return empty array when no e-services exist for the producer", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const results = await readModelService.getArchivingImminentEservices(
      producer.id
    );

    expect(results).toEqual([]);
  });

  it("should return descriptors whose archiving becomes definitive within the next 7 days", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const eservice = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(23),
      daysFromNow(3)
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingImminentEservices(
      producer.id
    );

    expect(results.length).toBe(1);
    expect(results[0].eserviceId).toBe(eservice.id);
    expect(results[0].totalCount).toBe(1);
  });

  it("should not return descriptors whose archiving becomes definitive after the next 7 days", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const eservice = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(1),
      daysFromNow(30)
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingImminentEservices(
      producer.id
    );

    expect(results).toEqual([]);
  });

  it("should order results from most to least imminent", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const soon = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(27),
      daysFromNow(1)
    );
    const later = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(24),
      daysFromNow(6)
    );
    await addOneEService(soon);
    await addOneEService(later);

    const results = await readModelService.getArchivingImminentEservices(
      producer.id
    );

    expect(results.length).toBe(2);
    expect(results[0].eserviceId).toBe(soon.id);
    expect(results[1].eserviceId).toBe(later.id);
  });

  it("should not return imminent archiving belonging to a different producer", async () => {
    const producer = getMockTenant();
    const otherProducer = getMockTenant();
    await addOneTenant(producer);
    await addOneTenant(otherProducer);

    const eservice = createMockEServiceWithScheduledArchiving(
      otherProducer.id,
      daysAgo(1),
      daysFromNow(3)
    );
    await addOneEService(eservice);

    const results = await readModelService.getArchivingImminentEservices(
      producer.id
    );

    expect(results).toEqual([]);
  });
});

describe("ReadModelService - getArchivingScopeCounts", () => {
  it("should return zero counts when the producer has no e-services in archiving", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const counts = await readModelService.getArchivingScopeCounts(producer.id);

    expect(counts).toEqual({ eserviceScopeCount: 0, descriptorScopeCount: 0 });
  });

  it("should count e-service-scope and descriptor-scope schedules separately", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const descriptorScoped = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(1),
      daysFromNow(30),
      archivingScope.descriptor
    );
    const eserviceScopedA = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(2),
      daysFromNow(30),
      archivingScope.eservice
    );
    const eserviceScopedB = createMockEServiceWithScheduledArchiving(
      producer.id,
      daysAgo(3),
      daysFromNow(30),
      archivingScope.eservice
    );
    await addOneEService(descriptorScoped);
    await addOneEService(eserviceScopedA);
    await addOneEService(eserviceScopedB);

    const counts = await readModelService.getArchivingScopeCounts(producer.id);

    expect(counts).toEqual({ eserviceScopeCount: 2, descriptorScopeCount: 1 });
  });

  it("should not count schedules belonging to a different producer", async () => {
    const producer = getMockTenant();
    const otherProducer = getMockTenant();
    await addOneTenant(producer);
    await addOneTenant(otherProducer);

    const eservice = createMockEServiceWithScheduledArchiving(
      otherProducer.id,
      daysAgo(1),
      daysFromNow(30)
    );
    await addOneEService(eservice);

    const counts = await readModelService.getArchivingScopeCounts(producer.id);

    expect(counts).toEqual({ eserviceScopeCount: 0, descriptorScopeCount: 0 });
  });
});

/**
 * Creates a producer e-service with a single descriptor in the archiving countdown
 * and subscribes the consumer to that descriptor.
 */
const setupConsumerArchivingScenario = async ({
  consumerId,
  startedAt = daysAgo(1),
  archivableOn = daysFromNow(30),
  scope = archivingScope.descriptor,
  agreementStateValue = agreementState.active,
  descriptorStateValue = descriptorState.archiving,
}: {
  consumerId: TenantId;
  startedAt?: Date;
  archivableOn?: Date;
  scope?: ArchivingSchedule["scope"];
  agreementStateValue?: AgreementState;
  descriptorStateValue?: DescriptorState;
}): Promise<EService> => {
  const producer = getMockTenant();
  await addOneTenant(producer);

  const baseEservice = createMockEServiceWithScheduledArchiving(
    producer.id,
    startedAt,
    archivableOn,
    scope
  );
  const eservice: EService = {
    ...baseEservice,
    descriptors: [
      { ...baseEservice.descriptors[0], state: descriptorStateValue },
    ],
  };
  await addOneEService(eservice);

  await addOneAgreement(
    createMockAgreement(eservice.id, consumerId, {
      descriptorId: eservice.descriptors[0].id,
      producerId: producer.id,
      state: agreementStateValue,
    })
  );

  return eservice;
};

describe("ReadModelService - getConsumerArchivingInProgressEservices", () => {
  it("should return empty array when the consumer has no subscriptions in archiving", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results).toEqual([]);
  });

  it("should return descriptors in archiving the consumer has an active agreement on", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const eservice = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(60),
    });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results.length).toBe(1);
    expect(results[0].eserviceId).toBe(eservice.id);
    expect(results[0].descriptorId).toBe(eservice.descriptors[0].id);
    expect(results[0].eserviceName).toBe(eservice.name);
    expect(results[0].version).toBe("3");
    expect(results[0].scope).toBe("Descriptor");
    expect(results[0].totalCount).toBe(1);
  });

  it("should include suspended agreements and ArchivingSuspended descriptors", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      agreementStateValue: agreementState.suspended,
    });
    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      descriptorStateValue: descriptorState.archivingSuspended,
    });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results.length).toBe(2);
  });

  it("should not return descriptors whose agreement is not active or suspended", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      agreementStateValue: agreementState.archived,
    });
    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      agreementStateValue: agreementState.pending,
    });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results).toEqual([]);
  });

  it("should not return descriptors already archived even if the schedule is kept", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      descriptorStateValue: descriptorState.archived,
    });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results).toEqual([]);
  });

  it("should not return archiving e-services subscribed by a different consumer", async () => {
    const consumer = getMockTenant();
    const otherConsumer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(otherConsumer);

    await setupConsumerArchivingScenario({ consumerId: otherConsumer.id });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results).toEqual([]);
  });

  it("should only return the descriptor the consumer is subscribed to for an e-service-scope archiving", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(producer);

    // E-service scope: every descriptor gets its own schedule row
    const schedule: ArchivingSchedule = {
      startedAt: daysAgo(1),
      archivableOn: daysFromNow(30),
      scope: archivingScope.eservice,
      gracePeriodDays: 30,
    };
    const subscribedDescriptor = {
      ...getMockDescriptor(),
      version: "2",
      state: descriptorState.archiving,
      archivingSchedule: schedule,
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [
        {
          ...getMockDescriptor(),
          version: "1",
          state: descriptorState.archiving,
          archivingSchedule: schedule,
        },
        subscribedDescriptor,
      ],
    };
    await addOneEService(eservice);
    await addOneAgreement(
      createMockAgreement(eservice.id, consumer.id, {
        descriptorId: subscribedDescriptor.id,
        producerId: producer.id,
        state: agreementState.active,
      })
    );

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results.length).toBe(1);
    expect(results[0].descriptorId).toBe(subscribedDescriptor.id);
    expect(results[0].scope).toBe("EService");
  });

  it("should order results from most to least recently started", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const older = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(10),
    });
    const newer = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(1),
    });

    const results =
      await readModelService.getConsumerArchivingInProgressEservices(
        consumer.id
      );

    expect(results.length).toBe(2);
    expect(results[0].eserviceId).toBe(newer.id);
    expect(results[1].eserviceId).toBe(older.id);
  });
});

describe("ReadModelService - getConsumerArchivingImminentEservices", () => {
  it("should return descriptors whose archiving becomes definitive within the next 7 days", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const eservice = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(23),
      archivableOn: daysFromNow(3),
    });

    const results =
      await readModelService.getConsumerArchivingImminentEservices(consumer.id);

    expect(results.length).toBe(1);
    expect(results[0].eserviceId).toBe(eservice.id);
    expect(results[0].totalCount).toBe(1);
  });

  it("should not return descriptors whose archiving becomes definitive after the next 7 days", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      archivableOn: daysFromNow(30),
    });

    const results =
      await readModelService.getConsumerArchivingImminentEservices(consumer.id);

    expect(results).toEqual([]);
  });

  it("should order results from most to least imminent", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const later = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(24),
      archivableOn: daysFromNow(6),
    });
    const soon = await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      startedAt: daysAgo(27),
      archivableOn: daysFromNow(1),
    });

    const results =
      await readModelService.getConsumerArchivingImminentEservices(consumer.id);

    expect(results.length).toBe(2);
    expect(results[0].eserviceId).toBe(soon.id);
    expect(results[1].eserviceId).toBe(later.id);
  });

  it("should not return imminent archiving subscribed by a different consumer", async () => {
    const consumer = getMockTenant();
    const otherConsumer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(otherConsumer);

    await setupConsumerArchivingScenario({
      consumerId: otherConsumer.id,
      archivableOn: daysFromNow(3),
    });

    const results =
      await readModelService.getConsumerArchivingImminentEservices(consumer.id);

    expect(results).toEqual([]);
  });
});

describe("ReadModelService - getConsumerArchivingScopeCounts", () => {
  it("should return zero counts when the consumer has no subscriptions in archiving", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    const counts = await readModelService.getConsumerArchivingScopeCounts(
      consumer.id
    );

    expect(counts).toEqual({ eserviceScopeCount: 0, descriptorScopeCount: 0 });
  });

  it("should count e-service-scope and descriptor-scope schedules separately", async () => {
    const consumer = getMockTenant();
    await addOneTenant(consumer);

    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      scope: archivingScope.descriptor,
    });
    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      scope: archivingScope.eservice,
    });
    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      scope: archivingScope.eservice,
    });

    const counts = await readModelService.getConsumerArchivingScopeCounts(
      consumer.id
    );

    expect(counts).toEqual({ eserviceScopeCount: 2, descriptorScopeCount: 1 });
  });

  it("should not count schedules of e-services subscribed by a different consumer or already archived", async () => {
    const consumer = getMockTenant();
    const otherConsumer = getMockTenant();
    await addOneTenant(consumer);
    await addOneTenant(otherConsumer);

    await setupConsumerArchivingScenario({ consumerId: otherConsumer.id });
    await setupConsumerArchivingScenario({
      consumerId: consumer.id,
      descriptorStateValue: descriptorState.archived,
    });

    const counts = await readModelService.getConsumerArchivingScopeCounts(
      consumer.id
    );

    expect(counts).toEqual({ eserviceScopeCount: 0, descriptorScopeCount: 0 });
  });
});
