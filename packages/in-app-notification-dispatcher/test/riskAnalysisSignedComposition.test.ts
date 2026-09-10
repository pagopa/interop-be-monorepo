import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeEventEnvelope,
  riskAnalysisSigningState,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import {
  insertTenantNotificationConfig,
  insertUserNotificationConfig,
} from "pagopa-interop-readmodel/testUtils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
} from "./utils.js";
vi.unmock("pagopa-interop-notification-commons");
describe("risk analysis signed notification composition", () => {
  const consumer = getMockTenant();
  const eservice = getMockEService();
  const signerId = generateId<UserId>();
  const otherReviewerId = generateId<UserId>();
  const adminId = generateId<UserId>();
  const { logger } = getMockContext({});
  const adminType = "purposeRiskAnalysisSignedToAdmin";
  const reviewerType = "purposeRiskAnalysisSignedToReviewer";
  beforeEach(async () => {
    await addOneTenant(consumer);
    await addOneEService(eservice);
    await insertTenantNotificationConfig(
      readModelDB,
      {
        ...getMockTenantNotificationConfig(),
        tenantId: consumer.id,
        enabled: true,
      },
      1
    );
  });
  it.each([
    {
      name: "admins and other reviewers",
      otherReviewer: true,
      adminEnabled: true,
      reviewerEnabled: true,
    },
    {
      name: "signer is the only reviewer",
      otherReviewer: false,
      adminEnabled: true,
      reviewerEnabled: true,
    },
    {
      name: "admin preference disabled",
      otherReviewer: true,
      adminEnabled: false,
      reviewerEnabled: true,
    },
    {
      name: "reviewer preference disabled",
      otherReviewer: true,
      adminEnabled: true,
      reviewerEnabled: false,
    },
    {
      name: "both preferences disabled",
      otherReviewer: true,
      adminEnabled: false,
      reviewerEnabled: false,
    },
  ])(
    "notifies the expected recipients when $name",
    async ({ otherReviewer, adminEnabled, reviewerEnabled }) => {
      for (const userId of [signerId, otherReviewerId, adminId]) {
        const config = getMockUserNotificationConfig();
        await insertUserNotificationConfig(
          readModelDB,
          {
            ...config,
            userId,
            tenantId: consumer.id,
            userRoles: [
              userId === adminId ? authRole.ADMIN_ROLE : authRole.REVIEWER_ROLE,
            ],
            inAppNotificationPreference: true,
            inAppConfig: {
              ...config.inAppConfig,
              [adminType]: adminEnabled,
              [reviewerType]: reviewerEnabled,
            },
          },
          1
        );
      }
      const purpose = {
        ...getMockPurpose(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        reviewerWorkflow: {
          reviewers: (otherReviewer
            ? [signerId, otherReviewerId]
            : [signerId]
          ).map((id) => ({ id })),
          signedBy: signerId,
          signingState: riskAnalysisSigningState.signed,
        },
      };
      const event: PurposeEventEnvelope = {
        event_version: 2,
        type: "PurposeRiskAnalysisSigned",
        data: { purpose: toPurposeV2(purpose) },
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
        ...(otherReviewer && reviewerEnabled
          ? [{ userId: otherReviewerId, kind: reviewerType }]
          : []),
        ...(adminEnabled ? [{ userId: adminId, kind: adminType }] : []),
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
