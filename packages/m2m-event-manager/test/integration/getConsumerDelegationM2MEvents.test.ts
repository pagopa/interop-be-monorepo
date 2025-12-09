import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import { ConsumerDelegationM2MEventType } from "pagopa-interop-models";
import { getMockedConsumerDelegationM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writeConsumerDelegationM2MEvent,
} from "../integrationUtils.js";

describe("getConsumerDelegationM2MEvents", () => {
  const mockConsumerDelegationM2MEvents = ConsumerDelegationM2MEventType.options
    .map((type) => [
      getMockedConsumerDelegationM2MEvent(type),
      getMockedConsumerDelegationM2MEvent(type),
      getMockedConsumerDelegationM2MEvent(type),
      getMockedConsumerDelegationM2MEvent(type),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(
      mockConsumerDelegationM2MEvents.map(writeConsumerDelegationM2MEvent)
    );
  });

  it("should list all consumerDelegation M2M events", async () => {
    const events = await m2mEventService.getConsumerDelegationM2MEvents(
      undefined,
      mockConsumerDelegationM2MEvents.length,
      getMockContextM2M({})
    );
    expect(events).toEqual(mockConsumerDelegationM2MEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest consumerDelegation M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getConsumerDelegationM2MEvents(
        undefined,
        limit,
        getMockContextM2M({})
      );
      expect(events).toEqual(
        mockConsumerDelegationM2MEvents.slice(0, limit) // get the first N events
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest consumerDelegation M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockConsumerDelegationM2MEvents[2].id;
      const events = await m2mEventService.getConsumerDelegationM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      const filteredEvents = mockConsumerDelegationM2MEvents.filter(
        (e) => e.id > lastEventId
      );
      expect(events).toEqual(
        filteredEvents.slice(0, limit) // get the first N events after the lastEventId
      );
    }
  );
});
