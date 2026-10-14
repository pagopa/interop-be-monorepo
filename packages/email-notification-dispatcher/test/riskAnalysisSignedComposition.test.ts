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
import { beforeEach, describe, expect, it } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneEService,
  addOneTenant,
  readModelDB,
  readModelService,
  templateService,
} from "./utils.js";

describe("risk analysis signed notification composition", () => {
  const consumer = getMockTenant();
  const eservice = getMockEService();
  const signerId = generateId<UserId>();
  const otherReviewerId = generateId<UserId>();
  const adminId = generateId<UserId>();
  const { logger, correlationId } = getMockContext({});
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
            emailNotificationPreference: true,
            emailConfig: {
              ...config.emailConfig,
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
      const notifications = await handlePurposeEvent({
        decodedMessage: event,
        logger,
        correlationId,
        readModelService,
        templateService,
      });
      const expected = [
        ...(otherReviewer && reviewerEnabled
          ? [
              {
                userId: otherReviewerId,
                kind: "L'analisi del rischio assegnata a te è già stata approvata",
              },
            ]
          : []),
        ...(adminEnabled
          ? [
              {
                userId: adminId,
                kind: "Un'analisi del rischio è stata approvata",
              },
            ]
          : []),
      ];
      expect(notifications).toHaveLength(expected.length);
      expect(
        notifications.map((notification) => ({
          userId:
            notification.type === "User" ? notification.userId : undefined,
          kind: notification.email.subject,
        }))
      ).toEqual(expect.arrayContaining(expected));
    }
  );
});
