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
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  RiskAnalysisReviewModeV2,
  PurposeId,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisAssignmentRemovedToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisAssignmentRemovedToReviewer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handlePurposeRiskAnalysisAssignmentRemovedToReviewer", () => {
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUserId = generateId<UserId>();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    name: "E-service test",
  };
  const consumer = getMockTenant(consumerId);
  const purpose: Purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
  };
  const body =
    "L'amministratore ha rimosso l'assegnazione dell'analisi del rischio per la finalità Finalità test associata all'e-service E-service test.";
  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(getMockTenant(eservice.producerId));
  });

  it("should throw when purpose is missing", async () => {
    await expect(
      handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
        undefined,
        reviewerIds,
        logger,
        readModelService,
        "PurposeRiskAnalysisAssigned"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisAssigned")
    );
  });

  it("should not create notifications when there are no reviewers to notify", async () => {
    const notifications =
      await handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
        toPurposeV2(purpose),
        [],
        logger,
        readModelService,
        "PurposeRiskAnalysisSelfAssigned"
      );

    expect(
      notifications.filter(
        ({ notificationType }) =>
          notificationType === "purposeRiskAnalysisAssignmentRemovedToReviewer"
      )
    ).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });

  const events: Array<{ name: string; event: PurposeEventEnvelope }> = [
    {
      name: "self-assigned",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisSelfAssigned",
        data: {
          purpose: toPurposeV2({
            ...purpose,
            riskAnalysisReviewMode:
              riskAnalysisReviewMode.adminWritesAdminSigns,
            reviewerWorkflow: undefined,
          }),
          previousRiskAnalysisReviewMode:
            RiskAnalysisReviewModeV2.REVIEWER_WRITES_REVIEWER_SIGNS,
          removedReviewers: reviewerIds.map((id) => ({
            id,
            sentToReviewerAt: 1n,
          })),
        },
        sequence_num: 1,
        stream_id: purposeId,
        version: 1,
        log_date: new Date(),
      },
    },
    {
      name: "workflow-created",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisWorkflowCreated",
        data: {
          purpose: toPurposeV2({
            ...purpose,
            riskAnalysisReviewMode:
              riskAnalysisReviewMode.adminWritesReviewerSigns,
            reviewerWorkflow: {
              reviewers: [{ id: unrelatedUserId }],
              signingState: riskAnalysisSigningState.draft,
            },
          }),
          previousRiskAnalysisReviewMode:
            RiskAnalysisReviewModeV2.ADMIN_WRITES_REVIEWER_SIGNS,
          addedReviewers: [unrelatedUserId],
          removedReviewers: reviewerIds.map((id) => ({
            id,
            sentToReviewerAt: 1n,
          })),
        },
        sequence_num: 1,
        stream_id: purposeId,
        version: 1,
        log_date: new Date(),
      },
    },
    {
      name: "assigned",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisAssigned",
        data: {
          purpose: toPurposeV2({
            ...purpose,
            riskAnalysisReviewMode:
              riskAnalysisReviewMode.reviewerWritesReviewerSigns,
            reviewerWorkflow: {
              reviewers: [{ id: unrelatedUserId }],
              signingState: riskAnalysisSigningState.assigned,
            },
          }),
          previousRiskAnalysisReviewMode:
            RiskAnalysisReviewModeV2.REVIEWER_WRITES_REVIEWER_SIGNS,
          addedReviewers: [unrelatedUserId],
          removedReviewers: reviewerIds.map((id) => ({
            id,
            sentToReviewerAt: 1n,
          })),
        },
        sequence_num: 1,
        stream_id: purposeId,
        version: 1,
        log_date: new Date(),
      },
    },
  ];

  it.each(events)(
    "should notify only previously informed removed reviewers for a $name event",
    async ({ event }) => {
      mockGetNotificationRecipients.mockResolvedValue([
        ...reviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
        { userId: unrelatedUserId, tenantId: consumerId },
      ]);

      const notifications = await handlePurposeEvent(
        event,
        logger,
        readModelService
      );

      expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
        [consumerId],
        "purposeRiskAnalysisAssignmentRemovedToReviewer",
        readModelService,
        logger
      );
      expect(
        notifications.filter(
          ({ notificationType }) =>
            notificationType ===
            "purposeRiskAnalysisAssignmentRemovedToReviewer"
        )
      ).toEqual(
        reviewerIds.map((userId) => ({
          userId,
          tenantId: consumerId,
          body,
          notificationType:
            "purposeRiskAnalysisAssignmentRemovedToReviewer" as const,
          entityId: purposeId,
        }))
      );
    }
  );
});
