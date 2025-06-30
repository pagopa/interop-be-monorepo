import { describe, it, expect, beforeEach } from "vitest";
import {
  DelegationContractDocument,
  DelegationEventEnvelopeV2,
  delegationKind,
  generateId,
  ProducerDelegationSubmittedV2,
  toDelegationV2,
} from "pagopa-interop-models";
import { getMockDelegation } from "pagopa-interop-commons-test";
import { handleDelegationMessageV2 } from "../src/handlers/delegation/consumerServiceV2.js";
import { DelegationDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  resetTargetTables,
  getManyFromDb,
  delegationTables,
} from "./utils.js";

describe("Delegation messages consumers - handleDelegationMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(delegationTables);
  });

  it("ProducerDelegationSubmitted: upserts delegation, stamps, and contract documents", async () => {
    const mockContract: DelegationContractDocument = {
      id: generateId(),
      contentType: "application/pdf",
      createdAt: new Date(),
      name: "activationContract",
      path: "path",
      prettyName: "prettyName",
    };

    const mockDelegation = {
      ...getMockDelegation({
        kind: delegationKind.delegatedProducer,
      }),
      activationContract: mockContract,
    };

    const msgDelegationMetaVersion1: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 1,
      type: "ProducerDelegationSubmitted",
      event_version: 2,
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    const msgDelegationMetaVersion2: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 2,
      type: "ProducerDelegationSubmitted",
      event_version: 2,
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    await handleDelegationMessageV2(
      [msgDelegationMetaVersion1, msgDelegationMetaVersion2],
      dbContext
    );

    const delegations = await getManyFromDb(
      dbContext,
      DelegationDbTable.delegation,
      {
        id: mockDelegation.id,
      }
    );
    expect(delegations).toHaveLength(1);
    expect(delegations[0]?.id).toBe(mockDelegation.id);
    expect(delegations[0]?.metadataVersion).toBe(2);

    const stamps = await getManyFromDb(
      dbContext,
      DelegationDbTable.delegation_stamp,
      {
        delegationId: mockDelegation.id,
      }
    );

    expect(stamps).toHaveLength(1);
    expect(stamps[0].delegationId).toBe(mockDelegation.id);

    const docs = await getManyFromDb(
      dbContext,
      DelegationDbTable.delegation_contract_document,
      { delegationId: mockDelegation.id }
    );

    expect(docs).toHaveLength(1);
    expect(docs[0].delegationId).toBe(mockDelegation.id);
  });

  it("ProducerDelegationSubmitted: should throw error when delegation is missing", async () => {
    const msg: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "ProducerDelegationSubmitted",
      event_version: 2,
      data: {} as unknown as ProducerDelegationSubmittedV2,
      log_date: new Date(),
    };

    await expect(() =>
      handleDelegationMessageV2([msg], dbContext)
    ).rejects.toThrow("Delegation can't be missing in event message");
  });
});
