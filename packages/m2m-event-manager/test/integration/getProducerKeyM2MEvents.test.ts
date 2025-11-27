import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { ProducerKeyM2MEventType } from "pagopa-interop-models";
import { getMockedProducerKeyM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeProducerKeyM2MEvent,
} from "../integrationUtils.js";

describe("getProducerKeyM2MEvents", () => {
  const mockProducerKeyM2MEvents = ProducerKeyM2MEventType.options
    .map((type) => [
      getMockedProducerKeyM2MEvent(type),
      getMockedProducerKeyM2MEvent(type),
      getMockedProducerKeyM2MEvent(type),
      getMockedProducerKeyM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockProducerKeyM2MEvents.map(writeProducerKeyM2MEvent));
  });

  it("should list all key M2M events", async () => {
    const events = await m2mEventService.getProducerKeyM2MEvents(
      undefined,
      mockProducerKeyM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockProducerKeyM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest key M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getProducerKeyM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockProducerKeyM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest key M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockProducerKeyM2MEvents[2].id;
      const events = await m2mEventService.getProducerKeyM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockProducerKeyM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
