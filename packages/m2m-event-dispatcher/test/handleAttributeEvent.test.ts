/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, expect, it } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  AttributeAddedV1,
  AttributeEventEnvelope,
  toAttributeV1,
  AttributeM2MEventType,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import { handleAttributeEvent } from "../src/handlers/handleAttributeEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveLastAttributeM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAgreementEvent test", async () => {
  const attribute = getMockAttribute();
  it.each(
    AttributeM2MEventType.options.map((type) => ({
      ...getMockEventEnvelopeCommons(),
      stream_id: attribute.id,
      type,
      data: {
        attribute: toAttributeV1(attribute),
      },
    })) satisfies AttributeEventEnvelope[]
  )(
    "should write M2M event for AttributeAdded event",
    async (message: AttributeEventEnvelope) => {
      const eventTimestamp = new Date();

      await handleAttributeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      const attributeM2MEvent = await retrieveLastAttributeM2MEvent();
      expect(attributeM2MEvent).toEqual(
        match(attributeM2MEvent)
          .with({ eventType: "AttributeAdded" }, (e) => ({
            id: expect.any(String),
            eventType: e.eventType,
            eventTimestamp,
            attributeId: attribute.id,
          }))
          .exhaustive()
      );
    }
  );
});
