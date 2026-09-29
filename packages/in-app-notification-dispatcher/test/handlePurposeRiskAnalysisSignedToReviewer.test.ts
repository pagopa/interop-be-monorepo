import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  PurposeEventEnvelope,
  PurposeId,
  riskAnalysisSigningState,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisSignedToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisSignedToReviewer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handlePurposeRiskAnalysisSignedToReviewer", () => {
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const signedBy = generateId<UserId>();
  const otherReviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUserId = generateId<UserId>();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    name: "E-service test",
  };
  const consumer = getMockTenant(consumerId);
  const purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
    reviewerWorkflow: {
      reviewers: [signedBy, ...otherReviewerIds].map((id) => ({ id })),
      signingState: riskAnalysisSigningState.signed,
      signedBy,
    },
  } satisfies Purpose;
  const event: PurposeEventEnvelope = {
    event_version: 2,
    type: "PurposeRiskAnalysisSigned",
    data: { purpose: toPurposeV2(purpose) },
    sequence_num: 1,
    stream_id: purposeId,
    version: 1,
    log_date: new Date(),
  };
  const body =
    "L'analisi del rischio per la finalità Finalità test associata all'e-service E-service test è già stata approvata.";
  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneEService(eservice);
    await addOneTenant(consumer);
  });

  it("should throw when purpose is missing", async () => {
    await expect(
      handlePurposeRiskAnalysisSignedToReviewer(
        undefined,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSigned")
    );
  });

  it("should notify assigned reviewers except the signer", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: signedBy, tenantId: consumerId },
      ...otherReviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
      { userId: unrelatedUserId, tenantId: consumerId },
    ]);

    const notifications = await handlePurposeEvent(
      event,
      logger,
      readModelService
    );

    expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
      [consumerId],
      "purposeRiskAnalysisSignedToReviewer",
      readModelService,
      logger
    );
    expect(
      notifications.filter(
        ({ notificationType }) =>
          notificationType === "purposeRiskAnalysisSignedToReviewer"
      )
    ).toEqual(
      otherReviewerIds.map((userId) => ({
        userId,
        tenantId: consumerId,
        body,
        notificationType: "purposeRiskAnalysisSignedToReviewer" as const,
        entityId: purposeId,
      }))
    );
  });

  it("should not create notifications when the signer is the only reviewer", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);
    const singleReviewerPurpose: Purpose = {
      ...purpose,
      reviewerWorkflow: {
        ...purpose.reviewerWorkflow,
        reviewers: [{ id: signedBy }],
      },
    };

    const notifications = await handlePurposeEvent(
      {
        ...event,
        data: { purpose: toPurposeV2(singleReviewerPurpose) },
      },
      logger,
      readModelService
    );

    expect(
      notifications.filter(
        ({ notificationType }) =>
          notificationType === "purposeRiskAnalysisSignedToReviewer"
      )
    ).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalledWith(
      [consumerId],
      "purposeRiskAnalysisSignedToReviewer",
      readModelService,
      logger
    );
  });
});
