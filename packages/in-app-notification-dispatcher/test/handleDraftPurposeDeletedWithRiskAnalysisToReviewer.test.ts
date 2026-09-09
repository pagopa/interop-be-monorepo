import {
  getMockContext,
  getMockDescriptorPublished,
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
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handleDraftPurposeDeletedWithRiskAnalysisToReviewer } from "../src/handlers/purposes/handleDraftPurposeDeletedWithRiskAnalysisToReviewer.js";
import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handleDraftPurposeDeletedWithRiskAnalysisToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const notifiedReviewerId = generateId<UserId>();
  const unnotifiedReviewerId = generateId<UserId>();
  const unrelatedUserId = generateId<UserId>();
  const purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
    reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    reviewerWorkflow: {
      reviewers: [
        { id: notifiedReviewerId, sentToReviewerAt: new Date() },
        { id: unnotifiedReviewerId },
      ],
      signingState: riskAnalysisSigningState.draft,
    },
  } satisfies Purpose;
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    name: "E-service test",
    descriptors: [getMockDescriptorPublished()],
  };
  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneEService(eservice);
    await addOneTenant(getMockTenant(producerId));
    await addOneTenant(getMockTenant(consumerId));
  });

  it("should throw when purpose is missing", async () => {
    await expect(
      handleDraftPurposeDeletedWithRiskAnalysisToReviewer(
        undefined,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "DraftPurposeDeleted")
    );
  });

  it("should notify only reviewers previously informed of the assignment", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      { userId: notifiedReviewerId, tenantId: consumerId },
      { userId: unnotifiedReviewerId, tenantId: consumerId },
      { userId: unrelatedUserId, tenantId: consumerId },
    ]);
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "DraftPurposeDeleted",
      data: { purpose: toPurposeV2(purpose) },
      sequence_num: 1,
      stream_id: purposeId,
      version: 1,
      log_date: new Date(),
    };

    await expect(
      handlePurposeEvent(decodedMessage, logger, readModelService)
    ).resolves.toEqual([
      {
        userId: notifiedReviewerId,
        tenantId: consumerId,
        body: "L'amministratore ha eliminato la finalità Finalità test associata all'e-service E-service test con analisi del rischio approvata da te.",
        notificationType: "draftPurposeDeletedWithRiskAnalysisToReviewer",
        entityId: purposeId,
      },
    ]);
    expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
      [consumerId],
      "draftPurposeDeletedWithRiskAnalysisToReviewer",
      readModelService,
      logger
    );
  });

  it("should not query recipients when no reviewer was previously notified", async () => {
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "DraftPurposeDeleted",
      data: {
        purpose: toPurposeV2({
          ...purpose,
          reviewerWorkflow: {
            ...purpose.reviewerWorkflow,
            reviewers: [{ id: unnotifiedReviewerId }],
          },
        }),
      },
      sequence_num: 1,
      stream_id: purposeId,
      version: 1,
      log_date: new Date(),
    };

    await expect(
      handlePurposeEvent(decodedMessage, logger, readModelService)
    ).resolves.toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });
});
