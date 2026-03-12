import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { ProducerDelegationM2MEventType } from "pagopa-interop-models";
import { getMockedProducerDelegationM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeProducerDelegationM2MEvent,
} from "../integrationUtils.js";

describe("getProducerDelegationM2MEvents", () => {
  const mockProducerDelegationM2MEvents = ProducerDelegationM2MEventType.options
    .map((type) => [
      getMockedProducerDelegationM2MEvent(type),
      getMockedProducerDelegationM2MEvent(type),
      getMockedProducerDelegationM2MEvent(type),
      getMockedProducerDelegationM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(
      mockProducerDelegationM2MEvents.map(writeProducerDelegationM2MEvent)
    );
  });

  it("should list all producerDelegation M2M events", async () => {
    const events = await m2mEventService.getProducerDelegationM2MEvents(
      undefined,
      mockProducerDelegationM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockProducerDelegationM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest producerDelegation M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getProducerDelegationM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockProducerDelegationM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest producerDelegation M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockProducerDelegationM2MEvents[2].id;
      const events = await m2mEventService.getProducerDelegationM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockProducerDelegationM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
