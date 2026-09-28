import { getMockPurpose } from "pagopa-interop-commons-test";
import {
  generateId,
  NewPurposeVersionWaitingForApprovalV2,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeWaitingForApprovalV2,
  PurposeWaitingForApprovalReasonV2,
  purposeEventToBinaryDataV2,
  toPurposeV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  toCreateEventNewPurposeVersionWaitingForApproval,
  toCreateEventPurposeVersionOverQuotaUnsuspended,
  toCreateEventPurposeWaitingForApproval,
} from "../../src/model/domain/toEvent.js";

const events = [
  {
    name: "PurposeWaitingForApproval",
    create: toCreateEventPurposeWaitingForApproval,
    codec: PurposeWaitingForApprovalV2,
  },
  {
    name: "NewPurposeVersionWaitingForApproval",
    create: toCreateEventNewPurposeVersionWaitingForApproval,
    codec: NewPurposeVersionWaitingForApprovalV2,
  },
  {
    name: "PurposeVersionOverQuotaUnsuspended",
    create: toCreateEventPurposeVersionOverQuotaUnsuspended,
    codec: PurposeVersionOverQuotaUnsuspendedV2,
  },
];

describe.each(events)("$name reason payload", ({ create, codec }) => {
  const purpose = getMockPurpose();

  it.each([
    PurposeWaitingForApprovalReasonV2.PURPOSE_WAITING_FOR_APPROVAL_REASON_DAILY_CALLS_PER_CONSUMER,
    PurposeWaitingForApprovalReasonV2.PURPOSE_WAITING_FOR_APPROVAL_REASON_DAILY_CALLS_TOTAL,
    PurposeWaitingForApprovalReasonV2.PURPOSE_WAITING_FOR_APPROVAL_REASON_BOTH,
  ])(
    "round-trips reason %s without adding it to the purpose",
    (waitingForApprovalReason) => {
      const { event } = create({
        purpose,
        version: 0,
        versionId: generateId(),
        correlationId: generateId(),
        waitingForApprovalReason,
      });
      const decoded = codec.fromBinary(purposeEventToBinaryDataV2(event));
      expect(decoded.waitingForApprovalReason).toBe(waitingForApprovalReason);
      expect(decoded.purpose).toEqual(toPurposeV2(purpose));
      expect(decoded.purpose).not.toHaveProperty("waitingForApprovalReason");
    }
  );

  it("decodes historical payloads without inventing a reason", () => {
    const data = { purpose: toPurposeV2(purpose), versionId: generateId() };
    expect(
      codec.fromBinary(codec.toBinary(data)).waitingForApprovalReason
    ).toBeUndefined();
  });
});
