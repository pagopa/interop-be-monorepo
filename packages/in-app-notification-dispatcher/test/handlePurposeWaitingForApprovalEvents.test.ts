import {
  getMockContext,
  getMockPurpose,
  getMockPurposeVersion,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  PurposeVersion,
  generateId,
  toPurposeV2,
  PurposeEventEnvelope,
  PurposeId,
  PurposeV2,
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
  type EventEnvelopeMetadata = {
    event_version: 2;
    stream_id: PurposeId;
    sequence_num: number;
    version: number;
    log_date: Date;
  };

  const eservice = getMockEService();
  const purpose: Purpose = { ...getMockPurpose(), eserviceId: eservice.id };
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
    const envelope: EventEnvelopeMetadata = {
      event_version: 2 as const,
      stream_id: purpose.id,
      sequence_num: 1,
      version: 1,
      log_date: new Date(),
    };
    const waitingVersion: PurposeVersion = {
      ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
      waitingForApprovalReason: purposeWaitingForApprovalReason.dailyCallsTotal,
    };
    const data: { purpose: PurposeV2 } = {
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
      const envelope: EventEnvelopeMetadata = {
        event_version: 2 as const,
        stream_id: purpose.id,
        sequence_num: 1,
        version: 1,
        log_date: new Date(),
      };
      const waitingVersion: PurposeVersion = {
        ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
        waitingForApprovalReason: undefined,
      };
      const data: { purpose: PurposeV2 } = {
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
