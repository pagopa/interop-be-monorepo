import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  AttributeEventEnvelope,
  toAttributeV1,
  AttributeEvent,
  AttributeM2MEvent,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { handleAttributeEvent } from "../src/handlers/handleAttributeEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveLastAttributeM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAttributeEvent test", async () => {
  const attribute = getMockAttribute();
  vi.spyOn(testM2mEventWriterService, "insertAttributeM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(
    AttributeEvent.options.map((o) => ({
      ...getMockEventEnvelopeCommons(),
      event_version: 1, // Force event_version to 1 for AttributeEvent
      stream_id: attribute.id,
      type: o.shape.type.value,
      data: {
        attribute: toAttributeV1(attribute),
      },
    })) as AttributeEventEnvelope[]
  )(
    "should correctly handle M2M event for $type event",
    async (message: AttributeEventEnvelope) => {
      const eventTimestamp = new Date();

      await handleAttributeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      await match(message)
        .with({ type: "AttributeAdded" }, async (m) => {
          expect(
            testM2mEventWriterService.insertAttributeM2MEvent
          ).toHaveBeenCalledTimes(1);
          const attributeM2MEvent = await retrieveLastAttributeM2MEvent();
          const expectedAttributeM2MEvent: AttributeM2MEvent = {
            id: expect.any(String),
            eventType: m.type,
            eventTimestamp,
            attributeId: attribute.id,
          };
          expect(attributeM2MEvent).toEqual(expectedAttributeM2MEvent);
        })
        .with({ type: "MaintenanceAttributeDeleted" }, () => {
          expect(
            testM2mEventWriterService.insertAttributeM2MEvent
          ).toHaveBeenCalledTimes(0);
        })
        .exhaustive();
    }
  );
});
