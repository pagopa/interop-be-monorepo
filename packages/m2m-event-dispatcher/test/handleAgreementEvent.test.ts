import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockDelegation,
  getMockAgreement,
  toAgreementV1,
} from "pagopa-interop-commons-test";
import {
  toAgreementV2,
  AgreementEventV2,
  AgreementEventEnvelopeV2,
  m2mEventVisibility,
  delegationKind,
  agreementState,
  generateId,
  TenantId,
  delegationState,
  Delegation,
  AgreementEventEnvelopeV1,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { EachMessagePayload, KafkaMessage } from "kafkajs";
import { handleAgreementEvent } from "../src/handlers/handleAgreementEvent.js";
import {
  addOneDelegationToReadModel,
  bigIntReplacer,
  getMockEventEnvelopeCommons,
  mockProcessMessage,
  retrieveAllAgreementM2MEvents,
  retrieveLastAgreementM2MEvent,
  testM2mEventWriterService,
  testReadModelService,
  TopicNames,
} from "./utils.js";

describe("handleAgreementEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertAgreementM2MEvent");

  beforeEach(async () => {
    vi.clearAllMocks();
    await addOneDelegationToReadModel(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
      })
    );
    await addOneDelegationToReadModel(
      getMockDelegation({
        kind: delegationKind.delegatedConsumer,
      })
    );
  });

  describe.each(AgreementEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: AgreementEventV2["type"]) =>
      describe.each(["with Delegations", "without Delegations"] as const)(
        "test case: %s",
        async (testCase) =>
          it.each(Object.values(agreementState))(
            "should write M2M event with the right visibility for agreement in state %s",
            async (state) => {
              const agreement = getMockAgreement(undefined, undefined, state);

              let producerDelegation: Delegation | undefined;
              let consumerDelegation: Delegation | undefined;

              await match(testCase)
                .with("with Delegations", async () => {
                  producerDelegation = getMockDelegation({
                    eserviceId: agreement.eserviceId,
                    kind: delegationKind.delegatedProducer,
                    delegatorId: agreement.producerId,
                    delegateId: generateId<TenantId>(),
                    state: delegationState.active,
                  });
                  consumerDelegation = getMockDelegation({
                    eserviceId: agreement.eserviceId,
                    kind: delegationKind.delegatedConsumer,
                    delegatorId: agreement.consumerId,
                    delegateId: generateId<TenantId>(),
                    state: delegationState.active,
                  });
                  await addOneDelegationToReadModel(producerDelegation);
                  await addOneDelegationToReadModel(consumerDelegation);
                })
                .with("without Delegations", async () => void 0)
                .exhaustive();

              const message = {
                ...getMockEventEnvelopeCommons(),
                stream_id: agreement.id,
                type: eventType,
                data: {
                  agreement: toAgreementV2(agreement),
                },
              } as AgreementEventEnvelopeV2;

              const eventTimestamp = new Date();

              const expectedVisibility = await match(eventType)
                .with(
                  P.union(
                    // Draft Agreement events, owner visibility
                    "AgreementAdded",
                    "DraftAgreementUpdated",
                    "AgreementSetDraftByPlatform",
                    "AgreementSetMissingCertifiedAttributesByPlatform",
                    "AgreementConsumerDocumentAdded",
                    "AgreementConsumerDocumentRemoved"
                  ),
                  async () => m2mEventVisibility.owner
                )
                .with(
                  P.union(
                    // Agreement events after submission, restricted visibility
                    "AgreementActivated",
                    "AgreementSubmitted",
                    "AgreementUpgraded",
                    "AgreementRejected",
                    "AgreementSuspendedByProducer",
                    "AgreementSuspendedByConsumer",
                    "AgreementSuspendedByPlatform",
                    "AgreementUnsuspendedByProducer",
                    "AgreementUnsuspendedByConsumer",
                    "AgreementUnsuspendedByPlatform",
                    "AgreementArchivedByConsumer",
                    "AgreementArchivedByUpgrade",
                    "AgreementArchivedByRevokedDelegation",
                    "AgreementSignedContractGenerated"
                  ),
                  async () => m2mEventVisibility.restricted
                )
                .with(
                  P.union(
                    // Agreement events both for before and after submission,
                    // visibility depends on the state
                    "AgreementDeleted",
                    "AgreementDeletedByRevokedDelegation"
                  ),
                  async () =>
                    match(state)
                      .with(
                        agreementState.draft,
                        agreementState.missingCertifiedAttributes,
                        () => m2mEventVisibility.owner
                      )
                      .with(
                        agreementState.pending,
                        agreementState.active,
                        agreementState.suspended,
                        agreementState.archived,
                        agreementState.rejected,
                        () => m2mEventVisibility.restricted
                      )
                      .exhaustive()
                )
                /**
                 * Not handled events
                 */
                .with("AgreementContractGenerated", () => undefined)
                .exhaustive();

              await handleAgreementEvent(
                message,
                eventTimestamp,
                genericLogger,
                testM2mEventWriterService,
                testReadModelService
              );

              if (expectedVisibility === undefined) {
                expect(
                  testM2mEventWriterService.insertAgreementM2MEvent
                ).not.toHaveBeenCalled();
                return;
              }

              expect(
                testM2mEventWriterService.insertAgreementM2MEvent
              ).toHaveBeenCalledTimes(1);
              const actualM2MEvent = await retrieveLastAgreementM2MEvent();
              expect(actualM2MEvent).toEqual({
                id: expect.any(String),
                eventType: message.type,
                eventTimestamp,
                resourceVersion: message.version,
                agreementId: agreement.id,
                consumerId: agreement.consumerId,
                producerId: agreement.producerId,
                consumerDelegateId: consumerDelegation?.delegateId,
                consumerDelegationId: consumerDelegation?.id,
                producerDelegateId: producerDelegation?.delegateId,
                producerDelegationId: producerDelegation?.id,
                visibility: expectedVisibility,
              });
            }
          )
      )
  );

  it("should not write the event if the same resource version is already present", async () => {
    const agreement = getMockAgreement();

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: agreement.id,
      type: "AgreementAdded",
      data: {
        agreement: toAgreementV2(agreement),
      },
    } as AgreementEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handleAgreementEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert the same event again: should be skipped
    await handleAgreementEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert one with a further resource version: should be inserted
    await handleAgreementEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.insertAgreementM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllAgreementM2MEvents({ limit: 10 })).toHaveLength(2);
  });
});

describe("V1 Event Skipping", () => {
  it("should skip V1 events by not calling insertAgreementM2MEvent and resolving", async () => {
    vi.clearAllMocks();

    const agreement = getMockAgreement();
    const message: AgreementEventEnvelopeV1 = {
      ...getMockEventEnvelopeCommons(),
      stream_id: agreement.id,
      type: "AgreementAdded",
      event_version: 1,
      data: {
        agreement: toAgreementV1(agreement),
      },
    };

    const jsonString = JSON.stringify(message, bigIntReplacer);

    const kafkaMessage: KafkaMessage = {
      key: null,
      value: Buffer.from(jsonString),
      timestamp: "0",
      size: 0,
      attributes: 0,
      offset: "0",
      headers: undefined,
    };

    const eachMessagePayload: EachMessagePayload = {
      topic: "event-store.agreement.events",
      partition: 0,
      message: kafkaMessage,
      heartbeat: async () => {
        /* no-op in mock */
      },
      pause: () => () => {
        /* no-op in mock */
      },
    };

    await mockProcessMessage({
      agreementTopic: "event-store.agreement.events",
    } as TopicNames)(eachMessagePayload);

    expect(
      testM2mEventWriterService.insertAgreementM2MEvent
    ).not.toHaveBeenCalled();

    expect(await retrieveAllAgreementM2MEvents({ limit: 10 })).toHaveLength(0);
  });
});
