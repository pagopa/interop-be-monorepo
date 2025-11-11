import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { KeyM2MEventType } from "pagopa-interop-models";
import { getMockedKeyM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeKeyM2MEvent,
} from "../integrationUtils.js";

describe("getKeyM2MEvents", () => {
  const mockKeyM2MEvents = KeyM2MEventType.options
    .map((type) => [
      getMockedKeyM2MEvent(type),
      getMockedKeyM2MEvent(type),
      getMockedKeyM2MEvent(type),
      getMockedKeyM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockKeyM2MEvents.map(writeKeyM2MEvent));
  });

  it("should list all key M2M events", async () => {
    const events = await m2mEventService.getKeyM2MEvents(
      undefined,
      mockKeyM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockKeyM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest key M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getKeyM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockKeyM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest key M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockKeyM2MEvents[2].id;
      const events = await m2mEventService.getKeyM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockKeyM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
