import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  Purpose,
  PurposeEventEnvelope,
  UserId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  RiskAnalysisReviewModeV2,
  toPurposeV2,
} from "pagopa-interop-models";
import { insertUserNotificationConfig } from "pagopa-interop-readmodel/testUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
} from "./utils.js";
vi.unmock("pagopa-interop-notification-commons");

describe("risk analysis mode change notification composition", () => {
  const consumer = getMockTenant();
  const producer = getMockTenant();
  const eservice = { ...getMockEService(), producerId: producer.id };
  const kept = generateId<UserId>();
  const added = generateId<UserId>();
  const removed = generateId<UserId>();
  const unaware = generateId<UserId>();
  const unrelated = generateId<UserId>();
  const { logger } = getMockContext({});
  const writingType =
    "purposeRiskAnalysisAssignedForWritingAndSigningToReviewer";
  const removalType = "purposeRiskAnalysisAssignmentRemovedToReviewer";

  beforeEach(async () => {
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    for (const userId of [kept, added, removed, unaware, unrelated]) {
      const config = getMockUserNotificationConfig();
      await insertUserNotificationConfig(
        readModelDB,
        {
          ...config,
          userId,
          tenantId: consumer.id,
          userRoles: [authRole.REVIEWER_ROLE],
          inAppNotificationPreference: true,
          inAppConfig: {
            ...config.inAppConfig,
            [writingType]: true,
            [removalType]: true,
            purposeRiskAnalysisAssignedForSigningToReviewer: true,
          },
        },
        1
      );
    }
  });

  it.each([
    { toWriting: true, changeReviewers: true },
    { toWriting: false, changeReviewers: true },
    { toWriting: true, changeReviewers: false },
    { toWriting: false, changeReviewers: false },
  ])(
    "notifies each role correctly with toWriting=$toWriting and changeReviewers=$changeReviewers",
    async ({ toWriting, changeReviewers }) => {
      const currentIds = changeReviewers ? [kept, added] : [kept];
      const purpose: Purpose = {
        ...getMockPurpose(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        riskAnalysisReviewMode: toWriting
          ? riskAnalysisReviewMode.reviewerWritesReviewerSigns
          : riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerWorkflow: {
          signingState: toWriting
            ? riskAnalysisSigningState.assigned
            : riskAnalysisSigningState.draft,
          reviewers: currentIds.map((id) => ({
            id,
            sentToReviewerAt: toWriting
              ? new Date("2026-09-14T10:00:00Z")
              : undefined,
          })),
        },
      };
      const event: PurposeEventEnvelope = {
        event_version: 2,
        type: toWriting
          ? "PurposeRiskAnalysisAssigned"
          : "PurposeRiskAnalysisWorkflowCreated",
        data: {
          purpose: toPurposeV2(purpose),
          previousRiskAnalysisReviewMode: toWriting
            ? RiskAnalysisReviewModeV2.ADMIN_WRITES_REVIEWER_SIGNS
            : RiskAnalysisReviewModeV2.REVIEWER_WRITES_REVIEWER_SIGNS,
          addedReviewers: changeReviewers ? [added] : [],
          removedReviewers: changeReviewers
            ? [
                { id: removed, sentToReviewerAt: 1n },
                ...(toWriting ? [{ id: unaware }] : []),
              ]
            : [],
        },
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        log_date: new Date(),
      };
      const notifications = await handlePurposeEvent(
        event,
        logger,
        readModelService
      );
      const expected = [
        ...(toWriting
          ? currentIds.map((userId) => ({ userId, kind: writingType }))
          : [{ userId: kept, kind: removalType }]),
        ...(changeReviewers ? [{ userId: removed, kind: removalType }] : []),
      ];
      expect(notifications).toHaveLength(expected.length);
      expect(
        notifications.map((notification) => ({
          userId: notification.userId,
          kind: notification.notificationType,
        }))
      ).toEqual(expect.arrayContaining(expected));
    }
  );
});
