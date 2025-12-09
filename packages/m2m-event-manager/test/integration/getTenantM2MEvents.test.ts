import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { TenantM2MEventType } from "pagopa-interop-models";
import { getMockedTenantM2MEvent } from "../mockUtils.js";
import { m2mEventService, writeTenantM2MEvent } from "../integrationUtils.js";

describe("getTenantM2MEvents", () => {
  const mockTenantM2MEvents = TenantM2MEventType.options
    .map((type) => [
      getMockedTenantM2MEvent(type),
      getMockedTenantM2MEvent(type),
      getMockedTenantM2MEvent(type),
      getMockedTenantM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockTenantM2MEvents.map(writeTenantM2MEvent));
  });

  it("should list all tenant M2M events", async () => {
    const events = await m2mEventService.getTenantM2MEvents(
      undefined,
      mockTenantM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockTenantM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest tenant M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getTenantM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockTenantM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest tenant M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockTenantM2MEvents[2].id;
      const events = await m2mEventService.getTenantM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockTenantM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
