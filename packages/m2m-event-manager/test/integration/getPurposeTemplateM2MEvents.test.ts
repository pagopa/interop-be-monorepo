import { beforeEach, describe, expect, it } from "vitest";
import { getMockContextM2M } from "pagopa-interop-commons-test";
import {
  PurposeTemplateM2MEventType,
  TenantId,
  generateId,
  m2mEventVisibility,
} from "pagopa-interop-models";
import { purposeTemplateInM2MEvent } from "pagopa-interop-m2m-event-db-models";
import { getMockedPurposeTemplateM2MEvent } from "../mockUtils.js";
import {
  m2mEventService,
  writePurposeTemplateM2MEvent,
  m2mEventDB,
} from "../integrationUtils.js";

describe("getPurposeTemplateM2MEvents", () => {
  const mockCreatorId: TenantId = generateId();

  const mockPurposeTemplateM2MEvents = PurposeTemplateM2MEventType.options
    .flatMap((eventType) => [
      getMockedPurposeTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.public,
      }),
      getMockedPurposeTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
        creatorId: mockCreatorId,
      }),
      getMockedPurposeTemplateM2MEvent({
        eventType,
        visibility: m2mEventVisibility.owner,
      }),
    ])
    .sort((a, b) => a.id.localeCompare(b.id));

  beforeEach(async () => {
    await m2mEventDB.delete(purposeTemplateInM2MEvent);

    for (const event of mockPurposeTemplateM2MEvents) {
      await writePurposeTemplateM2MEvent(event);
    }
  });

  it("should list only public purposeTemplate M2M events", async () => {
    const expectedPublicEvents = mockPurposeTemplateM2MEvents.filter(
      (e) => e.visibility === m2mEventVisibility.public
    );

    const events = await m2mEventService.getPurposeTemplateM2MEvents(
      undefined,
      expectedPublicEvents.length,
      getMockContextM2M({})
    );

    expect(events).toHaveLength(expectedPublicEvents.length);
    expect(events).toEqual(expectedPublicEvents);
  });

  it("should list public & owner purposeTemplate M2M events (requester = creator)", async () => {
    const expectedVisibleEvents = mockPurposeTemplateM2MEvents.filter(
      (e) =>
        e.visibility === m2mEventVisibility.public ||
        (e.visibility === m2mEventVisibility.owner &&
          e.creatorId === mockCreatorId)
    );

    const events = await m2mEventService.getPurposeTemplateM2MEvents(
      undefined,
      expectedVisibleEvents.length,
      getMockContextM2M({
        organizationId: mockCreatorId,
      })
    );

    expect(events).toHaveLength(expectedVisibleEvents.length);
    expect(events).toEqual(expectedVisibleEvents);
  });

  it.each([1, 3])(
    "should list the %d oldest public events after the given lastEventId",
    async (limit) => {
      const publicEvents = mockPurposeTemplateM2MEvents.filter(
        (e) => e.visibility === m2mEventVisibility.public
      );

      const lastEventId = publicEvents[0].id;
      const expectedEvents = publicEvents
        .filter((e) => e.id > lastEventId)
        .slice(0, limit);

      const events = await m2mEventService.getPurposeTemplateM2MEvents(
        lastEventId,
        limit,
        getMockContextM2M({})
      );

      expect(events).toEqual(expectedEvents);
    }
  );
});
