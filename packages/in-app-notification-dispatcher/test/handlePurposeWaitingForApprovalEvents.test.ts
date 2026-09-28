import {
  getMockContext,
  getMockPurpose,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  generateId,
  toPurposeV2,
  PurposeEventEnvelope,
  PurposeWaitingForApprovalReasonV2,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { addOneEService, readModelService } from "./utils.js";

vi.mock(
  "../src/handlers/purposes/handlePurposeQuotaAdjustmentRequestToProducer.js",
  () => ({
    handlePurposeQuotaAdjustmentRequestToProducer: vi
      .fn()
      .mockResolvedValue([]),
  })
);

describe("waiting-for-approval in-app event routing", () => {
  const eservice = getMockEService();
  const purpose = { ...getMockPurpose(), eserviceId: eservice.id };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    vi.mocked(getNotificationRecipients).mockResolvedValue([
      { userId: generateId(), tenantId: purpose.consumerId },
    ]);
  });

  it.each([
    "PurposeWaitingForApproval",
    "NewPurposeVersionWaitingForApproval",
    "PurposeVersionOverQuotaUnsuspended",
  ] as const)("forwards the reason for %s", async (type) => {
    const envelope = {
      event_version: 2 as const,
      stream_id: purpose.id,
      sequence_num: 1,
      version: 1,
      log_date: new Date(),
    };
    const data = {
      purpose: toPurposeV2(purpose),
      waitingForApprovalReason:
        PurposeWaitingForApprovalReasonV2.PURPOSE_WAITING_FOR_APPROVAL_REASON_DAILY_CALLS_TOTAL,
    };
    const decodedMessage: PurposeEventEnvelope =
      type === "PurposeWaitingForApproval"
        ? { ...envelope, type, data }
        : { ...envelope, type, data: { ...data, versionId: generateId() } };
    const notifications = await handlePurposeEvent(
      decodedMessage,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toContain(
      "sono già state superate le soglie totali"
    );
  });
});
