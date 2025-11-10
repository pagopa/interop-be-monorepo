import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDelegation } from "pagopa-interop-commons-test";
import {
  DelegationEvent,
  DelegationEventV2,
  toDelegationV2,
  DelegationEventEnvelopeV2,
  delegationKind,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { handleDelegationEvent } from "../src/handlers/handleDelegationEvent.js";
import {
  getMockEventEnvelopeCommons,
  retrieveAllConsumerDelegationM2MEvents,
  retrieveLastConsumerDelegationM2MEvent,
  retrieveAllProducerDelegationM2MEvents,
  retrieveLastProducerDelegationM2MEvent,
  testM2mEventWriterService,
} from "./utils.js";

describe("handleDelegationEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertConsumerDelegationM2MEvent");
  vi.spyOn(testM2mEventWriterService, "insertProducerDelegationM2MEvent");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(DelegationEventV2.options.map((o) => o.shape.type.value))(
    "should write %s M2M event with the right visibility (kind: delegatedConsumer)",
    async (eventType: DelegationEvent["type"]) => {
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
      });
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: delegation.id,
        type: eventType,
        data: {
          delegation: toDelegationV2(delegation),
        },
      } as DelegationEventEnvelopeV2;

      const eventTimestamp = new Date();

      const expectedM2MEvent = await match(eventType)
        .with(
          P.union(
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRejected",
            "ConsumerDelegationRevoked",
            "DelegationSignedContractGenerated",
            "ProducerDelegationSubmitted",
            "ProducerDelegationApproved",
            "ProducerDelegationRejected",
            "ProducerDelegationRevoked"
          ),
          async () => ({
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: message.version,
            delegationId: delegation.id,
          })
        )
        .with(P.union("DelegationContractGenerated"), () => undefined)
        .exhaustive();

      await handleDelegationEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      if (!expectedM2MEvent) {
        expect(
          testM2mEventWriterService.insertConsumerDelegationM2MEvent
        ).not.toHaveBeenCalled();
      } else {
        expect(
          testM2mEventWriterService.insertConsumerDelegationM2MEvent
        ).toHaveBeenCalledTimes(1);
        const actualM2MEvent = await retrieveLastConsumerDelegationM2MEvent();
        expect(actualM2MEvent).toEqual(expectedM2MEvent);
      }
    }
  );

  it.each(DelegationEventV2.options.map((o) => o.shape.type.value))(
    "should write %s M2M event with the right visibility (kind: delegatedProducer)",
    async (eventType: DelegationEvent["type"]) => {
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
      });
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: delegation.id,
        type: eventType,
        data: {
          delegation: toDelegationV2(delegation),
        },
      } as DelegationEventEnvelopeV2;

      const eventTimestamp = new Date();

      const expectedM2MEvent = await match(eventType)
        .with(
          P.union(
            "ProducerDelegationSubmitted",
            "ProducerDelegationApproved",
            "ProducerDelegationRejected",
            "ProducerDelegationRevoked",
            "DelegationSignedContractGenerated",
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRejected",
            "ConsumerDelegationRevoked"
          ),
          async () => ({
            id: expect.any(String),
            eventType,
            eventTimestamp,
            resourceVersion: message.version,
            delegationId: delegation.id,
          })
        )
        .with(P.union("DelegationContractGenerated"), () => undefined)
        .exhaustive();

      await handleDelegationEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService
      );

      if (!expectedM2MEvent) {
        expect(
          testM2mEventWriterService.insertProducerDelegationM2MEvent
        ).not.toHaveBeenCalled();
      } else {
        expect(
          testM2mEventWriterService.insertProducerDelegationM2MEvent
        ).toHaveBeenCalledTimes(1);
        const actualM2MEvent = await retrieveLastProducerDelegationM2MEvent();
        expect(actualM2MEvent).toEqual(expectedM2MEvent);
      }
    }
  );

  it("should not write the event if the same resource version is already present (consumer)", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
    });
    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: delegation.id,
      type: "ConsumerDelegationSubmitted",
      data: {
        delegation: toDelegationV2(delegation),
      },
    } as DelegationEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleDelegationEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert the same event again: should be skipped
    await handleDelegationEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleDelegationEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertConsumerDelegationM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllConsumerDelegationM2MEvents()).toHaveLength(2);
  });

  it("should not write the event if the same resource version is already present (producer)", async () => {
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
    });
    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: delegation.id,
      type: "ProducerDelegationSubmitted",
      data: {
        delegation: toDelegationV2(delegation),
      },
    } as DelegationEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleDelegationEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert the same event again: should be skipped
    await handleDelegationEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleDelegationEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.insertProducerDelegationM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllProducerDelegationM2MEvents()).toHaveLength(2);
  });
});
