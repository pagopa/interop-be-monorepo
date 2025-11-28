import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMockDelegation,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  randomArrayItem,
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
  purposeVersionState,
  PurposeVersion,
  PurposeM2MEvent,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { handlePurposeEvent } from "../src/handlers/handlePurposeEvent.js";
import { purposeEServiceNotFound } from "../src/models/errors.js";
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
            const consumerId = generateId<TenantId>();

            let producerDelegation: Delegation | undefined;
            let consumerDelegation: Delegation | undefined;

            await match(testCase)
              .with("with Delegations", async () => {
                producerDelegation = getMockDelegation({
                  eserviceId: eservice.id,
                  kind: delegationKind.delegatedProducer,
                  delegatorId: eservice.producerId,
                  delegateId: generateId<TenantId>(),
                  state: delegationState.active,
                });
                consumerDelegation = getMockDelegation({
                  eserviceId: eservice.id,
                  kind: delegationKind.delegatedConsumer,
                  delegatorId: consumerId,
                  delegateId: generateId<TenantId>(),
                  state: delegationState.active,
                });
                await addOneDelegationToReadModel(producerDelegation);
                await addOneDelegationToReadModel(consumerDelegation);
              })
              .with("without Delegations", async () => void 0)
              .exhaustive();

            await addOneEServiceToReadModel(eservice);

            const eventTimestamp = new Date();

            const testCasesData = match(eventType)
              .returnType<
                Array<{
                  versions: PurposeVersion[];
                  expectedVisibility: PurposeM2MEvent["visibility"];
                  affectedVersion?: number;
                  eventNotHandled?: boolean;
                }>
              >()
              .with(
                P.union(
                  // Draft Purpose events, owner visibility
                  "PurposeAdded",
                  "DraftPurposeUpdated",
                  "DraftPurposeDeleted",
                  "PurposeCloned"
                ),
                () => [
                  {
                    versions: [
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      // Visibility based only on event, versions state doesn't matter
                    ],
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                ]
              )
              .with(
                P.union(
                  // Published Purpose events, restricted visibility
                  "PurposeWaitingForApproval",
                  "PurposeActivated",
                  "WaitingForApprovalPurposeDeleted"
                ),
                () => [
                  {
                    versions: [
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      // Visibility based only on event, versions state doesn't matter
                    ],
                    expectedVisibility: m2mEventVisibility.restricted,
                  },
                ]
              )
              .with(
                P.union(
                  // Published Purpose Version events, restricted visibility
                  "PurposeArchived",
                  "PurposeVersionOverQuotaUnsuspended",
                  "PurposeVersionSuspendedByConsumer",
                  "PurposeVersionSuspendedByProducer",
                  "PurposeVersionUnsuspendedByConsumer",
                  "PurposeVersionUnsuspendedByProducer",
                  "PurposeVersionActivated",
                  "NewPurposeVersionActivated",
                  "WaitingForApprovalPurposeVersionDeleted",
                  "NewPurposeVersionWaitingForApproval",
                  "PurposeVersionRejected",
                  "RiskAnalysisSignedDocumentGenerated",
                  "PurposeVersionArchivedByRevokedDelegation"
                ),
                () => [
                  {
                    versions: [
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      getMockPurposeVersion(
                        randomArrayItem(Object.values(purposeVersionState))
                      ),
                      // Visibility based only on event, versions state doesn't matter
                    ],
                    affectedVersion: 1,
                    expectedVisibility: m2mEventVisibility.restricted,
                  },
                ]
              )
              .with(
                P.union(
                  // Purpose events both for Draft and Published Purposes,
                  // visibility depends on the state
                  "PurposeDeletedByRevokedDelegation"
                ),
                () => [
                  // All versions in draft / waiting for approval, owner visibility
                  {
                    versions: [
                      getMockPurposeVersion(purposeVersionState.draft),
                    ],
                    expectedVisibility: m2mEventVisibility.owner,
                  },
                  // At least one version published / waiting for approval, restricted visibility
                  {
                    versions: [
                      getMockPurposeVersion(
                        purposeVersionState.waitingForApproval
                      ),
                    ],
                    affectedVersion: undefined,
                    expectedVisibility: m2mEventVisibility.restricted,
                  },
                ]
              )
              .with(
                P.union(
                  // Ignored events
                  "RiskAnalysisDocumentGenerated"
                ),
                () => [
                  {
                    versions: [
                      getMockPurposeVersion(
                        purposeVersionState.waitingForApproval
                      ),
                    ],
                    expectedVisibility: m2mEventVisibility.restricted,
                    eventNotHandled: true,
                  },
                ]
              )
              .exhaustive();

            for (const testCaseData of testCasesData) {
              const {
                versions,
                expectedVisibility,
                affectedVersion,
                eventNotHandled,
              } = testCaseData;

              const purpose: Purpose = {
                ...getMockPurpose(),
                consumerId,
                eserviceId: eservice.id,
                versions,
              };

              const versionId =
                affectedVersion !== undefined
                  ? purpose.versions.at(affectedVersion)!.id
                  : undefined;

              const message = {
                ...getMockEventEnvelopeCommons(),
                stream_id: purpose.id,
                type: eventType,
                data: {
                  purpose: toPurposeV2(purpose),
                  versionId,
                },
              } as PurposeEventEnvelopeV2;

              if (eventNotHandled) {
                expect(
                  testM2mEventWriterService.insertPurposeM2MEvent
                ).not.toHaveBeenCalled();
                return;
              }

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
              vi.clearAllMocks();

              const actualM2MEvent = await retrieveLastPurposeM2MEvent();
              expect(actualM2MEvent).toEqual({
                id: expect.any(String),
                eventType,
                eventTimestamp,
                resourceVersion: message.version,
                purposeId: purpose.id,
                purposeVersionId: versionId,
                consumerId: purpose.consumerId,
                producerId: eservice.producerId,
                consumerDelegateId: consumerDelegation?.delegateId,
                consumerDelegationId: consumerDelegation?.id,
                producerDelegateId: producerDelegation?.delegateId,
                producerDelegationId: producerDelegation?.id,
                visibility: expectedVisibility,
              });
            }
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

    expect(await retrieveAllPurposeM2MEvents({ limit: 10 })).toHaveLength(2);
  });

  it("should throw purposeEServiceNotFound if the purpose e-service is not found in read model", async () => {
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
    await expect(
      handlePurposeEvent(
        message,
        eventTimestamp,
        genericLogger,
        testM2mEventWriterService,
        testReadModelService
      )
    ).rejects.toThrowError(
      purposeEServiceNotFound(purpose.eserviceId, purpose.id)
    );

    expect(
      testM2mEventWriterService.insertPurposeM2MEvent
    ).toHaveBeenCalledTimes(0);

    expect(await retrieveAllPurposeM2MEvents({ limit: 10 })).toHaveLength(0);
  });
});
