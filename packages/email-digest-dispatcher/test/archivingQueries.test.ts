import {
  getMockTenant,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  ArchivingSchedule,
  archivingScope,
  descriptorState,
  EService,
  TenantId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import {
  addOneEService,
  addOneTenant,
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
