import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDelegation } from "pagopa-interop-commons-test";
import {
  DelegationEvent,
  DelegationEventV2,
  toDelegationV2,
  DelegationEventEnvelopeV2,
  delegationKind,
  generateId,
  DelegationId,
  TenantId,
  m2mEventVisibility,
  AgreementM2MEvent,
  PurposeM2MEvent,
  EServiceM2MEvent,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { handleDelegationEvent } from "../src/handlers/handleDelegationEvent.js";
import { toPurposeM2MEventSQL } from "../src/models/purposeM2MEventAdapterSQL.js";
import { toAgreementM2MEventSQL } from "../src/models/agreementM2MEventAdapterSQL.js";
import { toEServiceM2MEventSQL } from "../src/models/eserviceM2MEventAdapterSQL.js";
import {
  getMockEventEnvelopeCommons,
  retrieveAllConsumerDelegationM2MEvents,
  retrieveLastConsumerDelegationM2MEvent,
  retrieveAllProducerDelegationM2MEvents,
  retrieveLastProducerDelegationM2MEvent,
  testM2mEventWriterService,
  retrieveAllAgreementM2MEvents,
  retrieveAllPurposeM2MEvents,
  retrieveAllEServiceM2MEvents,
} from "./utils.js";

describe("handleDelegationEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertConsumerDelegationM2MEvent");
  vi.spyOn(testM2mEventWriterService, "insertProducerDelegationM2MEvent");
  vi.spyOn(testM2mEventWriterService, "removeConsumerDelegationVisibility");
  vi.spyOn(testM2mEventWriterService, "removeProducerDelegationVisibility");

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

  it("should clear consumer delegation fields in existing events after ConsumerDelegationRevoked", async () => {
    const delegationId = generateId<DelegationId>();
    const delegateId = generateId<TenantId>();
    const otherDelegationId = generateId<DelegationId>();
    const otherDelegateId = generateId<TenantId>();

    const agreementEvent: AgreementM2MEvent = {
      id: generateId(),
      agreementId: generateId(),
      eventType: "DraftAgreementUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      consumerDelegationId: delegationId,
      consumerDelegateId: delegateId,
      producerId: generateId(),
      consumerId: generateId(),
    };

    const otherAgreementEvent: AgreementM2MEvent = {
      id: generateId(),
      agreementId: generateId(),
      eventType: "DraftAgreementUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      consumerDelegationId: otherDelegationId,
      consumerDelegateId: otherDelegateId,
      producerId: generateId(),
      consumerId: generateId(),
    };

    const purposeEvent: PurposeM2MEvent = {
      id: generateId(),
      purposeId: generateId(),
      eventType: "DraftPurposeUpdated",
      eventTimestamp: new Date(),
      visibility: "Restricted",
      resourceVersion: 1,
      consumerDelegationId: delegationId,
      consumerDelegateId: delegateId,
      consumerId: generateId(),
      producerId: generateId(),
    };

    const otherPurposeEvent: PurposeM2MEvent = {
      id: generateId(),
      purposeId: generateId(),
      eventType: "DraftPurposeUpdated",
      eventTimestamp: new Date(),
      visibility: "Restricted",
      resourceVersion: 1,
      consumerDelegationId: otherDelegationId,
      consumerDelegateId: otherDelegateId,
      consumerId: generateId(),
      producerId: generateId(),
    };

    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(agreementEvent)
    );
    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(otherAgreementEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(purposeEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(otherPurposeEvent)
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      id: delegationId,
    });

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: delegation.id,
      type: "ConsumerDelegationRevoked",
      data: { delegation: toDelegationV2(delegation) },
    } as DelegationEventEnvelopeV2;

    await handleDelegationEvent(
      message,
      new Date(),
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.removeConsumerDelegationVisibility
    ).toHaveBeenCalledTimes(1);

    const agreementM2MEvents = await retrieveAllAgreementM2MEvents({
      limit: 10,
    });
    const purposeM2MEvents = await retrieveAllPurposeM2MEvents({
      limit: 10,
    });

    const revokedAgreementEvent = agreementM2MEvents.find(
      (event) => event.id === agreementEvent.id
    )!;
    const untouchedAgreementEvent = agreementM2MEvents.find(
      (event) => event.id === otherAgreementEvent.id
    )!;
    const revokedPurposeEvent = purposeM2MEvents.find(
      (event) => event.id === purposeEvent.id
    )!;
    const untouchedPurposeEvent = purposeM2MEvents.find(
      (event) => event.id === otherPurposeEvent.id
    )!;

    expect(revokedAgreementEvent.consumerDelegationId).toBeUndefined();
    expect(revokedAgreementEvent.consumerDelegateId).toBeUndefined();
    expect(revokedPurposeEvent.consumerDelegationId).toBeUndefined();
    expect(revokedPurposeEvent.consumerDelegateId).toBeUndefined();

    expect(untouchedAgreementEvent.consumerDelegationId).toBe(
      otherDelegationId
    );
    expect(untouchedAgreementEvent.consumerDelegateId).toBe(otherDelegateId);
    expect(untouchedPurposeEvent.consumerDelegationId).toBe(otherDelegationId);
    expect(untouchedPurposeEvent.consumerDelegateId).toBe(otherDelegateId);
  });

  it("should clear producer delegation fields in existing events after ProducerDelegationRevoked", async () => {
    const delegationId = generateId<DelegationId>();
    const delegateId = generateId<TenantId>();
    const otherDelegationId = generateId<DelegationId>();
    const otherDelegateId = generateId<TenantId>();

    const eserviceEvent: EServiceM2MEvent = {
      id: generateId(),
      eserviceId: generateId(),
      eventType: "DraftEServiceUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      producerDelegationId: delegationId,
      producerDelegateId: delegateId,
      producerId: generateId(),
    };

    const otherEServiceEvent: EServiceM2MEvent = {
      id: generateId(),
      eserviceId: generateId(),
      eventType: "DraftEServiceUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      producerDelegationId: otherDelegationId,
      producerDelegateId: otherDelegateId,
      producerId: generateId(),
    };

    const agreementEvent: AgreementM2MEvent = {
      id: generateId(),
      agreementId: generateId(),
      eventType: "DraftAgreementUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      producerDelegationId: delegationId,
      producerDelegateId: delegateId,
      producerId: generateId(),
      consumerId: generateId(),
    };

    const otherAgreementEvent: AgreementM2MEvent = {
      id: generateId(),
      agreementId: generateId(),
      eventType: "DraftAgreementUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
      producerDelegationId: otherDelegationId,
      producerDelegateId: otherDelegateId,
      producerId: generateId(),
      consumerId: generateId(),
    };

    const purposeEvent: PurposeM2MEvent = {
      id: generateId(),
      purposeId: generateId(),
      eventType: "DraftPurposeUpdated",
      eventTimestamp: new Date(),
      visibility: "Restricted",
      resourceVersion: 1,
      producerDelegationId: delegationId,
      producerDelegateId: delegateId,
      consumerId: generateId(),
      producerId: generateId(),
    };

    const otherPurposeEvent: PurposeM2MEvent = {
      id: generateId(),
      purposeId: generateId(),
      eventType: "DraftPurposeUpdated",
      eventTimestamp: new Date(),
      visibility: "Restricted",
      resourceVersion: 1,
      producerDelegationId: otherDelegationId,
      producerDelegateId: otherDelegateId,
      consumerId: generateId(),
      producerId: generateId(),
    };

    await testM2mEventWriterService.insertEServiceM2MEvent(
      toEServiceM2MEventSQL(eserviceEvent)
    );
    await testM2mEventWriterService.insertEServiceM2MEvent(
      toEServiceM2MEventSQL(otherEServiceEvent)
    );
    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(agreementEvent)
    );
    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(otherAgreementEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(purposeEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(otherPurposeEvent)
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      id: delegationId,
    });

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: delegation.id,
      type: "ProducerDelegationRevoked",
      data: { delegation: toDelegationV2(delegation) },
    } as DelegationEventEnvelopeV2;

    await handleDelegationEvent(
      message,
      new Date(),
      genericLogger,
      testM2mEventWriterService
    );

    expect(
      testM2mEventWriterService.removeProducerDelegationVisibility
    ).toHaveBeenCalledTimes(1);

    const eserviceM2MEvents = await retrieveAllEServiceM2MEvents({ limit: 10 });
    const agreementM2MEvents = await retrieveAllAgreementM2MEvents({
      limit: 10,
    });
    const purposeM2MEvents = await retrieveAllPurposeM2MEvents({ limit: 10 });

    const revokedEServiceEvent = eserviceM2MEvents.find(
      (event) => event.id === eserviceEvent.id
    )!;
    const untouchedEServiceEvent = eserviceM2MEvents.find(
      (event) => event.id === otherEServiceEvent.id
    )!;
    const revokedAgreementEvent = agreementM2MEvents.find(
      (event) => event.id === agreementEvent.id
    )!;
    const untouchedAgreementEvent = agreementM2MEvents.find(
      (event) => event.id === otherAgreementEvent.id
    )!;
    const revokedPurposeEvent = purposeM2MEvents.find(
      (event) => event.id === purposeEvent.id
    )!;
    const untouchedPurposeEvent = purposeM2MEvents.find(
      (event) => event.id === otherPurposeEvent.id
    )!;

    expect(revokedEServiceEvent.producerDelegationId).toBeUndefined();
    expect(revokedEServiceEvent.producerDelegateId).toBeUndefined();
    expect(revokedAgreementEvent.producerDelegationId).toBeUndefined();
    expect(revokedAgreementEvent.producerDelegateId).toBeUndefined();
    expect(revokedPurposeEvent.producerDelegationId).toBeUndefined();
    expect(revokedPurposeEvent.producerDelegateId).toBeUndefined();

    expect(untouchedEServiceEvent.producerDelegationId).toBe(otherDelegationId);
    expect(untouchedEServiceEvent.producerDelegateId).toBe(otherDelegateId);
    expect(untouchedAgreementEvent.producerDelegationId).toBe(
      otherDelegationId
    );
    expect(untouchedAgreementEvent.producerDelegateId).toBe(otherDelegateId);
    expect(untouchedPurposeEvent.producerDelegationId).toBe(otherDelegationId);
    expect(untouchedPurposeEvent.producerDelegateId).toBe(otherDelegateId);
  });
});
