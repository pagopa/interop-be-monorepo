/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, expect, it } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeAddedV1,
  AttributeEventEnvelope,
  toAttributeV1,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { handleAttributeEvent } from "../src/handlers/handleAttributeEvent.js";
import {
  retrieveLastAttributeM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleAgreementEvent test", async () => {
  it("should write M2M event for AttributeAdded event", async () => {
    const attribute: Attribute = getMockAttribute();
    const payload: AttributeAddedV1 = {
      attribute: toAttributeV1(attribute),
    };
    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attribute.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    const eventTimestamp = new Date();

    await handleAttributeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    const attributeM2MEvent = await retrieveLastAttributeM2MEvent();
    expect(attributeM2MEvent).toEqual({
      id: expect.any(String),
      eventType: "AttributeAdded",
      eventTimestamp,
      attributeId: attribute.id,
    });
  });
});
