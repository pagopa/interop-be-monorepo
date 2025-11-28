import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { inject, afterEach, beforeEach, vi } from "vitest";
import {
  tenantInM2MEvent,
  TenantM2MEventSQL,
  attributeInM2MEvent,
  AttributeM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";
import { generateId } from "../../models/src/index.js";

export const { cleanup, m2mEventDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("m2mEventDbConfig")
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date());
});

afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
});

export const addTenantM2MEvent = async (
  events: TenantM2MEventSQL[]
): Promise<void> => {
  await m2mEventDB.insert(tenantInM2MEvent).values(events);
};

export const addAttributeM2MEvent = async (
  events: AttributeM2MEventSQL[]
): Promise<void> => {
  await m2mEventDB.insert(attributeInM2MEvent).values(events);
};

export const getTenantM2MEventSQLMock = (
  eventTimestamp: Date
): TenantM2MEventSQL => ({
  id: generateId(),
  eventType: "EVENT_TEST",
  eventTimestamp: eventTimestamp.toISOString(),
  resourceVersion: 1,
  tenantId: generateId(),
});

export const getAttributeM2MEventSQLMock = (
  eventTimestamp: Date
): AttributeM2MEventSQL => ({
  id: generateId(),
  eventType: "EVENT_TEST",
  eventTimestamp: eventTimestamp.toISOString(),
  resourceVersion: 1,
  attributeId: generateId(),
});
