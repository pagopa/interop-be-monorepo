import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  generateId,
  fromPurposeV2,
  purposeVersionState,
  NewPurposeVersionWaitingForApprovalV2,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeWaitingForApprovalV2,
  purposeWaitingForApprovalReason,
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
    purposeWaitingForApprovalReason.dailyCallsPerConsumer,
    purposeWaitingForApprovalReason.dailyCallsTotal,
    purposeWaitingForApprovalReason.both,
  ])(
    "round-trips reason %s on the affected version",
    (waitingForApprovalReason) => {
      const waitingVersion = {
        ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
        waitingForApprovalReason,
      };
      const updatedPurpose = {
        ...purpose,
        versions: [
          getMockPurposeVersion(purposeVersionState.active),
          waitingVersion,
        ],
      };
      const { event } = create({
        purpose: updatedPurpose,
        version: 0,
        versionId: waitingVersion.id,
        correlationId: generateId(),
      });
      const decoded = codec.fromBinary(purposeEventToBinaryDataV2(event));
      expect(decoded.purpose).toBeDefined();
      if (!decoded.purpose) throw new Error("Missing purpose");
      expect(fromPurposeV2(decoded.purpose).versions[1]).toEqual(
        waitingVersion
      );
      expect(
        fromPurposeV2(decoded.purpose).versions[0]?.waitingForApprovalReason
      ).toBeUndefined();
      expect(decoded.purpose).toEqual(toPurposeV2(updatedPurpose));
      expect(decoded.purpose).not.toHaveProperty("waitingForApprovalReason");
    }
  );

  it("decodes historical payloads without inventing a reason", () => {
    const data = { purpose: toPurposeV2(purpose), versionId: generateId() };
    const decoded = codec.fromBinary(codec.toBinary(data));
    if (!decoded.purpose) throw new Error("Missing purpose");
    expect(
      fromPurposeV2(decoded.purpose).versions.every(
        (v) => v.waitingForApprovalReason === undefined
      )
    ).toBe(true);
  });
});
