import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockDelegation,
  getMockEService,
  getMockPurpose,
} from "pagopa-interop-commons-test";
import {
  toPurposeV2,
  PurposeEventV2,
  PurposeEventEnvelopeV2,
  m2mEventVisibility,
  delegationKind,
  generateId,
  TenantId,
  delegationState,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handlePurposeEvent } from "../src/handlers/handlePurposeEvent.js";
import {
  addOneDelegationToReadModel,
  addOneEServiceToReadModel,
  getMockEventEnvelopeCommons,
  retrieveAllPurposeM2MEvents,
  retrieveLastPurposeM2MEvent,
  testM2mEventWriterService,
  testReadModelService,
} from "./utils.js";

describe("handlePurposeEvent test", async () => {
  vi.spyOn(testM2mEventWriterService, "insertPurposeM2MEvent");

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

  describe.each(PurposeEventV2.options.map((o) => o.shape.type.value))(
    "with %s event",
    (eventType: PurposeEventV2["type"]) =>
      describe.each(["with Delegations", "without Delegations"] as const)(
        "test case: %s",
        async (testCase) =>
          it("should write M2M event with the right visibility", async () => {
            const eservice = getMockEService();
            const purpose: Purpose = {
              ...getMockPurpose(),
              eserviceId: eservice.id,
            };

            let producerDelegation: Delegation | undefined;
            let consumerDelegation: Delegation | undefined;

            await match(testCase)
              .with("with Delegations", async () => {
                producerDelegation = getMockDelegation({
                  eserviceId: purpose.eserviceId,
                  kind: delegationKind.delegatedProducer,
                  delegatorId: eservice.producerId,
                  delegateId: generateId<TenantId>(),
                  state: delegationState.active,
                });
                consumerDelegation = getMockDelegation({
                  eserviceId: purpose.eserviceId,
                  kind: delegationKind.delegatedConsumer,
                  delegatorId: purpose.consumerId,
                  delegateId: generateId<TenantId>(),
                  state: delegationState.active,
                });
                await addOneDelegationToReadModel(producerDelegation);
                await addOneDelegationToReadModel(consumerDelegation);
              })
              .with("without Delegations", async () => void 0)
              .exhaustive();

            await addOneEServiceToReadModel(eservice);

            const message = {
              ...getMockEventEnvelopeCommons(),
              stream_id: purpose.id,
              type: eventType,
              data: {
                purpose: toPurposeV2(purpose),
              },
            } as PurposeEventEnvelopeV2;

            const eventTimestamp = new Date();

            const expectedVisibility = await match(eventType)
              .with(
                P.union(
                  // Draft Purpose events, owner visibility
                  "PurposeAdded",
                  "DraftPurposeUpdated",
                  "DraftPurposeDeleted",
                  "PurposeCloned",
                  "PurposeDeletedByRevokedDelegation"
                ),
                async () => m2mEventVisibility.owner
              )
              .with(
                P.union(
                  // Purpose events after submission, restricted visibility
                  "PurposeActivated",
                  "PurposeArchived",
                  "PurposeVersionOverQuotaUnsuspended",
                  "PurposeVersionSuspendedByConsumer",
                  "PurposeVersionSuspendedByProducer",
                  "PurposeVersionUnsuspendedByConsumer",
                  "PurposeVersionUnsuspendedByProducer",
                  "PurposeVersionActivated",
                  "NewPurposeVersionActivated",
                  "WaitingForApprovalPurposeVersionDeleted",
                  "WaitingForApprovalPurposeDeleted",
                  "PurposeWaitingForApproval",
                  "NewPurposeVersionWaitingForApproval",
                  "PurposeVersionRejected",
                  "RiskAnalysisDocumentGenerated",
                  "RiskAnalysisSignedDocumentGenerated",
                  "PurposeVersionArchivedByRevokedDelegation"
                ),
                async () => m2mEventVisibility.restricted
              )
              .exhaustive();

            await handlePurposeEvent(
              message,
              eventTimestamp,
              genericLogger,
              testM2mEventWriterService,
              testReadModelService
            );
            expect(
              testM2mEventWriterService.insertPurposeM2MEvent
            ).toHaveBeenCalledTimes(1);
            const actualM2MEvent = await retrieveLastPurposeM2MEvent();
            expect(actualM2MEvent).toEqual({
              id: expect.any(String),
              eventType: message.type,
              eventTimestamp,
              resourceVersion: message.version,
              purposeId: purpose.id,
              consumerId: purpose.consumerId,
              producerId: eservice.producerId,
              consumerDelegateId: consumerDelegation?.delegateId,
              consumerDelegationId: consumerDelegation?.id,
              producerDelegateId: producerDelegation?.delegateId,
              producerDelegationId: producerDelegation?.id,
              visibility: expectedVisibility,
            });
          })
      )
  );

  it("should not write the event if the same resource version is already present", async () => {
    const eservice = getMockEService();
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
    };

    await addOneEServiceToReadModel(eservice);

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: purpose.id,
      type: "PurposeAdded",
      data: {
        purpose: toPurposeV2(purpose),
      },
    } as PurposeEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handlePurposeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert the same event again: should be skipped
    await handlePurposeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert one with a further resource version: should be inserted
    await handlePurposeEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.insertPurposeM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllPurposeM2MEvents()).toHaveLength(2);
  });

  it("should not write the event if the same resource version is already present", async () => {
    const eservice = getMockEService();
    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
    };

    await addOneEServiceToReadModel(eservice);

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: purpose.id,
      type: "PurposeAdded",
      data: {
        purpose: toPurposeV2(purpose),
      },
    } as PurposeEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handlePurposeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert the same event again: should be skipped
    await handlePurposeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    // Try to insert one with a further resource version: should be inserted
    await handlePurposeEvent(
      { ...message, version: message.version + 1 },
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.insertPurposeM2MEvent
    ).toHaveBeenCalledTimes(3);

    expect(await retrieveAllPurposeM2MEvents()).toHaveLength(2);
  });

  it("should not write the event if the purpose e-service is not found in read model", async () => {
    const purpose = getMockPurpose();

    const message = {
      ...getMockEventEnvelopeCommons(),
      stream_id: purpose.id,
      type: "PurposeAdded",
      data: {
        purpose: toPurposeV2(purpose),
      },
    } as PurposeEventEnvelopeV2;

    const eventTimestamp = new Date();

    // Insert the event for the first time
    await handlePurposeEvent(
      message,
      eventTimestamp,
      genericLogger,
      testM2mEventWriterService,
      testReadModelService
    );

    expect(
      testM2mEventWriterService.insertPurposeM2MEvent
    ).toHaveBeenCalledTimes(0);

    expect(await retrieveAllPurposeM2MEvents()).toHaveLength(0);
  });
});
