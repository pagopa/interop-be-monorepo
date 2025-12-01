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
  AgreementId,
  PurposeId,
  EServiceId,
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
  retrieveLastAgreementM2MEvent,
  retrieveLastPurposeM2MEvent,
  retrieveLastEServiceM2MEvent,
  testReadModelService,
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
          testM2mEventWriterService,
          testReadModelService
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
        testM2mEventWriterService,
        testReadModelService
      );

      // Try to insert the same event again: should be skipped
      await handleDelegationEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService,
        testReadModelService
      );

      // Try to insert one with a further resource version: should be inserted
      await handleDelegationEvent(
        { ...message, version: message.version + 1 },
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService,
        testReadModelService
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

    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(agreementEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(purposeEvent)
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
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.removeConsumerDelegationVisibility
    ).toHaveBeenCalledTimes(1);

    const agreementM2MEvent = await retrieveLastAgreementM2MEvent();
    const purposeM2MEvent = await retrieveLastPurposeM2MEvent();

    expect(agreementM2MEvent.consumerDelegationId).toBeUndefined();
    expect(agreementM2MEvent.consumerDelegateId).toBeUndefined();

    expect(purposeM2MEvent.consumerDelegationId).toBeUndefined();
    expect(purposeM2MEvent.consumerDelegateId).toBeUndefined();
  });

  it("should add producer delegation visibility after ProducerDelegationApproved", async () => {
    const delegationId = generateId<DelegationId>();
    const delegateId = generateId<TenantId>();
    const eserviceId = generateId<EServiceId>();
    const agreementId = generateId<AgreementId>();
    const purposeId = generateId<PurposeId>();

    const eserviceEvent: EServiceM2MEvent = {
      id: generateId(),
      eserviceId,
      producerId: generateId(),
      eventType: "DraftEServiceUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
    };

    const agreementEvent: AgreementM2MEvent = {
      id: generateId(),
      agreementId,
      consumerId: generateId(),
      producerId: generateId(),
      eventType: "DraftAgreementUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.owner,
      resourceVersion: 1,
    };

    const purposeEvent: PurposeM2MEvent = {
      id: generateId(),
      purposeId,
      consumerId: generateId(),
      producerId: generateId(),
      eventType: "DraftPurposeUpdated",
      eventTimestamp: new Date(),
      visibility: m2mEventVisibility.restricted,
      resourceVersion: 1,
    };

    await testM2mEventWriterService.insertEServiceM2MEvent(
      toEServiceM2MEventSQL(eserviceEvent)
    );
    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(agreementEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(purposeEvent)
    );

    const getAgreementsSpy = vi
      .spyOn(testReadModelService, "getEServiceAgreementIds")
      .mockResolvedValue([agreementId]);
    const getPurposesSpy = vi
      .spyOn(testReadModelService, "getEServicePurposeIds")
      .mockResolvedValue([purposeId]);
    const addVisibilitySpy = vi.spyOn(
      testM2mEventWriterService,
      "addProducerDelegationVisibility"
    );

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      id: delegationId,
      eserviceId,
      delegateId,
    });

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: delegation.id,
      type: "ProducerDelegationApproved",
      data: { delegation: toDelegationV2(delegation) },
    } as DelegationEventEnvelopeV2;

    await handleDelegationEvent(
      message,
      new Date(),
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(getAgreementsSpy).toHaveBeenCalledWith(eserviceId);
    expect(getPurposesSpy).toHaveBeenCalledWith(eserviceId);
    expect(addVisibilitySpy).toHaveBeenCalledWith(
      eserviceId,
      delegationId,
      delegation.delegateId,
      [agreementId],
      [purposeId]
    );

    const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
    const agreementM2MEvent = await retrieveLastAgreementM2MEvent();
    const purposeM2MEvent = await retrieveLastPurposeM2MEvent();

    expect(eserviceM2MEvent.producerDelegationId).toBe(delegationId);
    expect(eserviceM2MEvent.producerDelegateId).toBe(delegation.delegateId);
    expect(agreementM2MEvent.producerDelegationId).toBe(delegationId);
    expect(agreementM2MEvent.producerDelegateId).toBe(delegation.delegateId);
    expect(purposeM2MEvent.producerDelegationId).toBe(delegationId);
    expect(purposeM2MEvent.producerDelegateId).toBe(delegation.delegateId);
  });

  it("should clear producer delegation fields in existing events after ProducerDelegationRevoked", async () => {
    const delegationId = generateId<DelegationId>();
    const delegateId = generateId<TenantId>();

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

    await testM2mEventWriterService.insertEServiceM2MEvent(
      toEServiceM2MEventSQL(eserviceEvent)
    );
    await testM2mEventWriterService.insertAgreementM2MEvent(
      toAgreementM2MEventSQL(agreementEvent)
    );
    await testM2mEventWriterService.insertPurposeM2MEvent(
      toPurposeM2MEventSQL(purposeEvent)
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
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.removeProducerDelegationVisibility
    ).toHaveBeenCalledTimes(1);

    const eserviceM2MEvent = await retrieveLastEServiceM2MEvent();
    const agreementM2MEvent = await retrieveLastAgreementM2MEvent();
    const purposeM2MEvent = await retrieveLastPurposeM2MEvent();

    expect(eserviceM2MEvent.producerDelegationId).toBeUndefined();
    expect(eserviceM2MEvent.producerDelegateId).toBeUndefined();

    expect(agreementM2MEvent.producerDelegationId).toBeUndefined();
    expect(agreementM2MEvent.producerDelegateId).toBeUndefined();

    expect(purposeM2MEvent.producerDelegationId).toBeUndefined();
    expect(purposeM2MEvent.producerDelegateId).toBeUndefined();
  });
});
