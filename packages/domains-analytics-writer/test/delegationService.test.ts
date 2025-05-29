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
  getOneFromDb,
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

    const envelope: DelegationEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockDelegation.id,
      version: 2,
      type: "ProducerDelegationSubmitted",
      event_version: 2,
      data: { delegation: toDelegationV2(mockDelegation) },
      log_date: new Date(),
    };

    await handleDelegationMessageV2([envelope], dbContext);

    const storedDelegation = await getOneFromDb(
      dbContext,
      DelegationDbTable.delegation,
      {
        id: mockDelegation.id,
      }
    );
    expect(storedDelegation).toBeDefined();
    expect(storedDelegation.id).toBe(mockDelegation.id);

    const storedStamps = await getManyFromDb(
      dbContext,
      DelegationDbTable.delegation_stamp,
      {
        delegationId: mockDelegation.id,
      }
    );

    expect(storedStamps).toHaveLength(1);
    expect(storedStamps[0].delegationId).toBe(mockDelegation.id);

    const storedDocs = await getManyFromDb(
      dbContext,
      DelegationDbTable.delegation_contract_document,
      { delegationId: mockDelegation.id }
    );

    expect(storedDocs).toHaveLength(1);
    expect(storedDocs[0].delegationId).toBe(mockDelegation.id);
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
