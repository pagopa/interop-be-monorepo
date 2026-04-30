import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  KeyM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { getMockedKeyM2MEvent } from "../mockUtils.js";
import { m2mEventService, writeKeyM2MEvent } from "../integrationUtils.js";

describe("getKeyM2MEvents", () => {
  const mockConsumerId: TenantId = generateId();

  const mockKeyM2MEvents = KeyM2MEventType.options
    .map((eventType) => [
      getMockedKeyM2MEvent(eventType, {
        consumerId: mockConsumerId,
        visibility: m2mEventVisibility.owner,
      }),
      getMockedKeyM2MEvent(eventType, {
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .flat();

  beforeEach(async () => {
    await Promise.all(mockKeyM2MEvents.map(writeKeyM2MEvent));
  });

  it("should not list key M2M events for non-owners", async () => {
    const events = await m2mEventService.getKeyM2MEvents(
      undefined,
      mockKeyM2MEvents.length,
      getMockContextM2M({
        organizationId: generateId<TenantId>(),
      })
    );
    expect(events).toEqual([]);
  });

  it("should list only owner key M2M events", async () => {
    const ownerEvents = mockKeyM2MEvents.filter(
      (event) => event.consumerId === mockConsumerId
    );

    const events = await m2mEventService.getKeyM2MEvents(
      undefined,
      mockKeyM2MEvents.length,
      getMockContextM2M({
        organizationId: mockConsumerId,
      })
    );
    expect(events).toEqual(ownerEvents);
  });

  it.each([1, 3, 10])(
    "should list the %d oldest owned key M2M events if lastEventId is not provided",
    async (limit) => {
      const events = await m2mEventService.getKeyM2MEvents(
        undefined,
        limit,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );
      expect(events).toEqual(
        mockKeyM2MEvents
          .filter((event) => event.consumerId === mockConsumerId)
          .slice(0, limit)
      );
    }
  );

  it.each([1, 3, 10])(
    "should list the %d oldest owned key M2M events after the given lastEventId",
    async (limit) => {
      const lastEventId = mockKeyM2MEvents[2].id;
      const events = await m2mEventService.getKeyM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({
          organizationId: mockConsumerId,
        })
      );

      const filteredEvents = mockKeyM2MEvents.filter(
        (event) => event.consumerId === mockConsumerId && event.id > lastEventId
      );
      expect(events).toEqual(filteredEvents.slice(0, limit));
    }
  );
});
