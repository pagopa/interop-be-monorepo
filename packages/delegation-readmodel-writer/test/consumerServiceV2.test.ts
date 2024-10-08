import { getMockDelegationProducer } from "pagopa-interop-commons-test/index.js";
import {
  DelegationEventEnvelopeV2,
  DelegationApprovedV2,
  DelegationRejectedV2,
  toDelegationV2,
  DelegationRevokedV2,
  DelegationSubmittedV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleMessageV2 } from "../src/delegationConsumerServiceV2.js";
import { delegations } from "./utils.js";

describe("Events V2", async () => {
  const mockDelegation = getMockDelegationProducer();
  const mockMessage: DelegationEventEnvelopeV2 = {
    event_version: 2,
    stream_id: mockDelegation.id,
    version: 1,
    sequence_num: 1,
    log_date: new Date(),
    type: "DelegationApproved",
    data: {},
  };

  it("DelegationApproved", async () => {
    const payload: DelegationApprovedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "DelegationApproved",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("DelegationRejected", async () => {
    const payload: DelegationRejectedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "DelegationRejected",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("DelegationRevoked", async () => {
    const payload: DelegationRevokedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "DelegationRevoked",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });

  it("DelegationSubmitted", async () => {
    const payload: DelegationSubmittedV2 = {
      delegation: toDelegationV2(mockDelegation),
    };

    const message: DelegationEventEnvelopeV2 = {
      ...mockMessage,
      type: "DelegationSubmitted",
      data: payload,
    };

    await handleMessageV2(message, delegations);

    const retrievedDelegation = await delegations.findOne({
      "data.id": mockDelegation.id,
    });

    expect(retrievedDelegation?.data).toEqual(mockDelegation);

    expect(retrievedDelegation?.metadata).toEqual({
      version: 1,
    });
  });
});
