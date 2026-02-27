import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { AttributeM2MEventType } from "pagopa-interop-models";
import { getMockedAttributeM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeAttributeM2MEvent,
} from "../integrationUtils.js";

describe("getAttributeM2MEvents", () => {
  const mockAttributeM2MEvents = AttributeM2MEventType.options
    .map((type) => [
      getMockedAttributeM2MEvent(type),
      getMockedAttributeM2MEvent(type),
      getMockedAttributeM2MEvent(type),
      getMockedAttributeM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockAttributeM2MEvents.map(writeAttributeM2MEvent));
  });

  it("should list all attribute M2M events", async () => {
    const events = await m2mEventService.getAttributeM2MEvents(
      undefined,
      mockAttributeM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockAttributeM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest attribute M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getAttributeM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockAttributeM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest attribute M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockAttributeM2MEvents[2].id;
      const events = await m2mEventService.getAttributeM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockAttributeM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
