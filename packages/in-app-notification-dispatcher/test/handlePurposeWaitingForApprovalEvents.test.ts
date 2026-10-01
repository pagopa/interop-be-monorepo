import {
  getMockContext,
  getMockPurpose,
  getMockPurposeVersion,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  generateId,
  toPurposeV2,
  PurposeEventEnvelope,
  purposeVersionState,
  purposeWaitingForApprovalReason,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeQuotaAdjustmentRequestToProducer } from "../src/handlers/purposes/handlePurposeQuotaAdjustmentRequestToProducer.js";
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
    vi.clearAllMocks();
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
    const waitingVersion = {
      ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
      waitingForApprovalReason: purposeWaitingForApprovalReason.dailyCallsTotal,
    };
    const data = {
      purpose: toPurposeV2({
        ...purpose,
        versions: [
          getMockPurposeVersion(purposeVersionState.active),
          waitingVersion,
        ],
      }),
    };
    const decodedMessage: PurposeEventEnvelope =
      type === "PurposeWaitingForApproval"
        ? { ...envelope, type, data }
        : {
            ...envelope,
            type,
            data: { ...data, versionId: waitingVersion.id },
          };
    const notifications = await handlePurposeEvent(
      decodedMessage,
      logger,
      readModelService
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toContain(
      "è stata superata la soglia totale"
    );
  });
  it.each([
    "PurposeWaitingForApproval",
    "NewPurposeVersionWaitingForApproval",
    "PurposeVersionOverQuotaUnsuspended",
  ] as const)(
    "skips consumer notifications and logs the missing reason for %s",
    async (type) => {
      const warn = vi.spyOn(logger, "warn");
      warn.mockClear();
      const envelope = {
        event_version: 2 as const,
        stream_id: purpose.id,
        sequence_num: 1,
        version: 1,
        log_date: new Date(),
      };
      const waitingVersion = {
        ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
        waitingForApprovalReason: undefined,
      };
      const data = {
        purpose: toPurposeV2({
          ...purpose,
          versions: [
            getMockPurposeVersion(purposeVersionState.active),
            waitingVersion,
          ],
        }),
      };
      const decodedMessage: PurposeEventEnvelope =
        type === "PurposeWaitingForApproval"
          ? { ...envelope, type, data }
          : {
              ...envelope,
              type,
              data: { ...data, versionId: waitingVersion.id },
            };
      const notifications = await handlePurposeEvent(
        decodedMessage,
        logger,
        readModelService
      );
      expect(notifications).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Expected waitingForApprovalReason was not found"
        )
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(waitingVersion.id)
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(type));
      if (type !== "PurposeVersionOverQuotaUnsuspended") {
        expect(
          handlePurposeQuotaAdjustmentRequestToProducer
        ).toHaveBeenCalledTimes(1);
      }
    }
  );
});
