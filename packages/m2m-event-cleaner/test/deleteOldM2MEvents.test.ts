import { eq } from "drizzle-orm";
import { logger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import {
  attributeInM2MEvent,
  tenantInM2MEvent,
} from "pagopa-interop-m2m-event-db-models";
import { deleteOldM2MEvents } from "../src/deleteOldM2MEvents.js";
import {
  addAttributeM2MEvent,
  addTenantM2MEvent,
  getAttributeM2MEventSQLMock,
  getTenantM2MEventSQLMock,
  m2mEventDB,
} from "./utils.js";

const loggerInstance = logger({ serviceName: "test" });

describe("deleteOldM2MEvents", () => {
  it("should delete m2m events older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldAttributeM2MEvent1 = getAttributeM2MEventSQLMock(
      new Date("2023-10-01T10:00:00Z") // 106 days old
    );

    const oldAttributeM2MEvent2 = getAttributeM2MEventSQLMock(
      new Date("2023-10-10T10:00:00Z") // 97 days old
    );

    const recentAttributeM2MEvent = getAttributeM2MEventSQLMock(
      new Date("2023-12-01T10:00:00Z") // 45 days old
    );

    const recentTenantM2MEvent = getTenantM2MEventSQLMock(
      new Date("2024-01-10T10:00:00Z") // 5 days old
    );

    await addAttributeM2MEvent([
      oldAttributeM2MEvent1,
      oldAttributeM2MEvent2,
      recentAttributeM2MEvent,
    ]);
    await addTenantM2MEvent([recentTenantM2MEvent]);

    // Delete m2m events older than 90 days
    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingAttributeM2MEvents = await m2mEventDB
      .select()
      .from(attributeInM2MEvent);

    expect(remainingAttributeM2MEvents).toHaveLength(1);
    expect(remainingAttributeM2MEvents[0].id).toBe(recentAttributeM2MEvent.id);

    const remainingTenantM2MEvents = await m2mEventDB
      .select()
      .from(tenantInM2MEvent);

    expect(remainingTenantM2MEvents).toHaveLength(1);
    expect(remainingTenantM2MEvents[0].id).toBe(recentTenantM2MEvent.id);
  });

  it("should delete all m2m events when all are older than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldAttributeM2MEvent1 = getAttributeM2MEventSQLMock(
      new Date("2023-01-01T10:00:00Z")
    );

    const oldAttributeM2MEvent2 = getAttributeM2MEventSQLMock(
      new Date("2023-02-01T10:00:00Z")
    );

    await addAttributeM2MEvent([oldAttributeM2MEvent1, oldAttributeM2MEvent2]);

    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingAttributeM2MEvents = await m2mEventDB
      .select()
      .from(attributeInM2MEvent);

    expect(remainingAttributeM2MEvents).toHaveLength(0);
  });

  it("should not delete any m2m events when all are newer than specified days", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const recentTenantM2MEvent1 = getTenantM2MEventSQLMock(
      new Date("2024-01-01T10:00:00Z")
    );

    const recentTenantM2MEvent2 = getTenantM2MEventSQLMock(
      new Date("2024-01-10T10:00:00Z")
    );

    await addTenantM2MEvent([recentTenantM2MEvent1, recentTenantM2MEvent2]);

    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);

    const remainingTenantM2MEvents = await m2mEventDB
      .select()
      .from(tenantInM2MEvent);

    expect(remainingTenantM2MEvents).toHaveLength(2);
  });

  it("should handle empty database", async () => {
    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(0);
  });

  it("should respect custom retention period", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const attributeEvent30DaysOld = getAttributeM2MEventSQLMock(
      new Date("2023-12-16T10:00:00Z") // 30 days old
    );

    const attributeEvent60DaysOld = getAttributeM2MEventSQLMock(
      new Date("2023-11-16T10:00:00Z") // 60 days old
    );

    const attributeEvent120DaysOld = getAttributeM2MEventSQLMock(
      new Date("2023-09-17T10:00:00Z") // 120 days old
    );

    await addAttributeM2MEvent([
      attributeEvent30DaysOld,
      attributeEvent60DaysOld,
      attributeEvent120DaysOld,
    ]);

    // Delete events older than 45 days
    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      45,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingAttributeM2MEvents = await m2mEventDB
      .select()
      .from(attributeInM2MEvent);

    expect(remainingAttributeM2MEvents).toHaveLength(1);
    expect(remainingAttributeM2MEvents[0].id).toBe(attributeEvent30DaysOld.id);
  });

  it("should delete m2m events regardless of event type", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldTenantM2MEventTypeCreated = {
      ...getTenantM2MEventSQLMock(new Date("2023-10-01T10:00:00Z")),
      eventType: "TENANT_CREATED",
    };

    const oldTenantM2MEventTypeUpdated = {
      ...getTenantM2MEventSQLMock(new Date("2023-10-05T10:00:00Z")),
      eventType: "TENANT_UPDATED",
    };

    await addTenantM2MEvent([
      oldTenantM2MEventTypeCreated,
      oldTenantM2MEventTypeUpdated,
    ]);

    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingTenantM2MEvents = await m2mEventDB
      .select()
      .from(tenantInM2MEvent);

    expect(remainingTenantM2MEvents).toHaveLength(0);
  });

  it("should delete events for different attributes and tenants", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const oldAttributeM2MEventUser1 = getAttributeM2MEventSQLMock(
      new Date("2023-10-01T10:00:00Z")
    );

    const oldAttributeM2MEventUser2 = getAttributeM2MEventSQLMock(
      new Date("2023-10-05T10:00:00Z")
    );

    const recentAttributeM2MEventUser1 = {
      ...getAttributeM2MEventSQLMock(new Date("2023-12-01T10:00:00Z")),
      attributeId: oldAttributeM2MEventUser1.attributeId,
    };

    await addAttributeM2MEvent([
      oldAttributeM2MEventUser1,
      oldAttributeM2MEventUser2,
      recentAttributeM2MEventUser1,
    ]);

    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    expect(deletedCount).toBe(2);

    const remainingAttributeM2MEvents = await m2mEventDB
      .select()
      .from(attributeInM2MEvent)
      .where(
        eq(
          attributeInM2MEvent.attributeId,
          oldAttributeM2MEventUser1.attributeId
        )
      );

    expect(remainingAttributeM2MEvents).toHaveLength(1);
    expect(remainingAttributeM2MEvents[0].id).toBe(
      recentAttributeM2MEventUser1.id
    );
  });

  it("should handle edge case at exact cutoff date", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    const tenantM2MEventAtCutoff = getTenantM2MEventSQLMock(
      new Date("2023-10-17T10:00:00Z") // Exactly 90 days
    );

    const tenantM2MEventBeyondCutoff = getTenantM2MEventSQLMock(
      new Date("2023-10-16T10:00:00Z") // 91 days
    );

    const tenantM2MEventBeforeCutoff = getTenantM2MEventSQLMock(
      new Date("2023-10-18T10:00:00Z") // 89 days
    );

    await addTenantM2MEvent([
      tenantM2MEventAtCutoff,
      tenantM2MEventBeyondCutoff,
      tenantM2MEventBeforeCutoff,
    ]);

    const deletedCount = await deleteOldM2MEvents(
      m2mEventDB,
      90,
      loggerInstance
    );

    // Should delete events older than 90 days (not including exactly 90 days)
    expect(deletedCount).toBe(1);

    const remainingTenantM2MEvents = await m2mEventDB
      .select()
      .from(tenantInM2MEvent);

    expect(remainingTenantM2MEvents).toHaveLength(2);
  });
});
