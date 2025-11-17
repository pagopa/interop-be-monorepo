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

  describe.each(Object.values(delegationKind))("with kind %s", (kind) => {
    it.each(DelegationEventV2.options.map((o) => o.shape.type.value))(
      "should write %s M2M event with the right visibility",
      async (eventType: DelegationEvent["type"]) => {
        const delegation = getMockDelegation({
          kind,
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

        const expectedM2MEvent = await match(kind)
          .with(delegationKind.delegatedProducer, () =>
            match(eventType)
              .with(
                P.union(
                  "ProducerDelegationSubmitted",
                  "ProducerDelegationApproved",
                  "ProducerDelegationRejected",
                  "ProducerDelegationRevoked",
                  "DelegationSignedContractGenerated"
                ),
                async () => ({
                  id: expect.any(String),
                  eventType,
                  eventTimestamp,
                  resourceVersion: message.version,
                  delegationId: delegation.id,
                })
              )
              .with(
                P.union(
                  "DelegationContractGenerated",
                  "ConsumerDelegationSubmitted",
                  "ConsumerDelegationApproved",
                  "ConsumerDelegationRejected",
                  "ConsumerDelegationRevoked"
                ),
                () => undefined
              )
              .exhaustive()
          )
          .with(delegationKind.delegatedConsumer, () =>
            match(eventType)
              .with(
                P.union(
                  "ConsumerDelegationSubmitted",
                  "ConsumerDelegationApproved",
                  "ConsumerDelegationRejected",
                  "ConsumerDelegationRevoked",
                  "DelegationSignedContractGenerated"
                ),
                async () => ({
                  id: expect.any(String),
                  eventType,
                  eventTimestamp,
                  resourceVersion: message.version,
                  delegationId: delegation.id,
                })
              )
              .with(
                P.union(
                  "DelegationContractGenerated",
                  "ProducerDelegationSubmitted",
                  "ProducerDelegationApproved",
                  "ProducerDelegationRejected",
                  "ProducerDelegationRevoked"
                ),
                () => undefined
              )
              .exhaustive()
          )
          .exhaustive();

        await handleDelegationEvent(
          message,
          eventTimestamp,
          genericLogger,
          testM2mEventWriterService
        );

        await match(kind)
          .with(delegationKind.delegatedConsumer, async () => {
            if (!expectedM2MEvent) {
              expect(
                testM2mEventWriterService.insertConsumerDelegationM2MEvent
              ).not.toHaveBeenCalled();
            } else {
              expect(
                testM2mEventWriterService.insertConsumerDelegationM2MEvent
              ).toHaveBeenCalledTimes(1);
              const actualM2MEvent =
                await retrieveLastConsumerDelegationM2MEvent();
              expect(actualM2MEvent).toEqual(expectedM2MEvent);
            }
          })
          .with(delegationKind.delegatedProducer, async () => {
            if (!expectedM2MEvent) {
              expect(
                testM2mEventWriterService.insertProducerDelegationM2MEvent
              ).not.toHaveBeenCalled();
            } else {
              expect(
                testM2mEventWriterService.insertProducerDelegationM2MEvent
              ).toHaveBeenCalledTimes(1);
              const actualM2MEvent =
                await retrieveLastProducerDelegationM2MEvent();
              expect(actualM2MEvent).toEqual(expectedM2MEvent);
            }
          })
          .exhaustive();
      }
    );

    it("should not write the event if the same resource version is already present", async () => {
      const delegation = getMockDelegation({
        kind,
      });
      const message = {
        ...getMockEventEnvelopeCommons(),
        stream_id: delegation.id,
        type: match(kind)
          .with(
            delegationKind.delegatedConsumer,
            () => "ConsumerDelegationSubmitted"
          )
          .with(
            delegationKind.delegatedProducer,
            () => "ProducerDelegationSubmitted"
          )
          .exhaustive(),
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

      await match(kind)
        .with(delegationKind.delegatedConsumer, async () => {
          expect(
            testM2mEventWriterService.insertConsumerDelegationM2MEvent
          ).toHaveBeenCalledTimes(3);

          expect(
            await retrieveAllConsumerDelegationM2MEvents({ limit: 10 })
          ).toHaveLength(2);
        })
        .with(delegationKind.delegatedProducer, async () => {
          expect(
            testM2mEventWriterService.insertProducerDelegationM2MEvent
          ).toHaveBeenCalledTimes(3);

          expect(
            await retrieveAllProducerDelegationM2MEvents({ limit: 10 })
          ).toHaveLength(2);
        })
        .exhaustive();
    });
  });
});
