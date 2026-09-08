import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantMail,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  PurposeEventEnvelope,
  UserNotificationConfig,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
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

describe("purposeRiskAnalysisSignedToAdmin", () => {
  const notificationType = "purposeRiskAnalysisSignedToAdmin";
  const consumer = { ...getMockTenant(), mails: [getMockTenantMail()] };
  const eservice = { ...getMockEService(), name: "E-service test" };
  const adminConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    tenantId: consumer.id,
    userRoles: [authRole.ADMIN_ROLE, authRole.API_ROLE],
    inAppNotificationPreference: true,
    emailNotificationPreference: true,
    inAppConfig: {
      ...getMockUserNotificationConfig().inAppConfig,
      [notificationType]: true,
    },
    emailConfig: {
      ...getMockUserNotificationConfig().emailConfig,
      [notificationType]: true,
    },
  };
  const reviewerConfig: UserNotificationConfig = {
    ...adminConfig,
    id: generateId(),
    userId: generateId(),
    userRoles: [authRole.REVIEWER_ROLE],
  };
  const purpose = {
    ...getMockPurpose(),
    title: "Finalità test",
    consumerId: consumer.id,
    eserviceId: eservice.id,
    reviewerWorkflow: {
      reviewers: [{ id: reviewerConfig.userId }],
      signingState: riskAnalysisSigningState.signed,
      signedBy: reviewerConfig.userId,
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
  const { logger } = getMockContext({});
  const dispatch = (decodedMessage: PurposeEventEnvelope = event) =>
    handlePurposeEvent(decodedMessage, logger, readModelService);

  beforeEach(async () => {
    await addOneTenant(consumer);
    await addOneEService(eservice);
  });

  it.each([
    riskAnalysisReviewMode.adminWritesReviewerSigns,
    riskAnalysisReviewMode.reviewerWritesReviewerSigns,
  ])(
    "notifies each eligible consumer admin once in %s mode, excluding reviewers and other tenants",
    async (reviewMode) => {
      const secondAdmin: UserNotificationConfig = {
        ...adminConfig,
        id: generateId(),
        userId: generateId(),
      };
      const otherTenantAdmin: UserNotificationConfig = {
        ...adminConfig,
        id: generateId(),
        userId: generateId(),
        tenantId: generateId(),
      };
      for (const userConfig of [
        adminConfig,
        secondAdmin,
        reviewerConfig,
        otherTenantAdmin,
      ]) {
        await insertUserNotificationConfig(readModelDB, userConfig, 1);
      }
      const notifications = await dispatch({
        ...event,
        data: { purpose: toPurposeV2({ ...purpose, reviewMode }) },
      });
      expect(notifications).toHaveLength(2);
      expect(notifications.map((n) => n.userId).sort()).toEqual(
        [adminConfig.userId, secondAdmin.userId].sort()
      );
      for (const notification of notifications) {
        expect(notification).toMatchObject({
          tenantId: consumer.id,
          notificationType,
          entityId: purpose.id,
          body: "L'analisi del rischio per la finalità Finalità test associata all'e-service E-service test è stata approvata.",
        });
      }
    }
  );

  it.each(["type", "channel"] as const)(
    "respects disabled %s preferences",
    async (preference) => {
      await insertUserNotificationConfig(
        readModelDB,
        {
          ...adminConfig,
          inAppNotificationPreference: preference !== "channel",
          inAppConfig: {
            ...adminConfig.inAppConfig,
            [notificationType]: preference !== "type",
          },
        },
        1
      );
      expect(await dispatch()).toEqual([]);
    }
  );

  it("returns no notifications without eligible admins", async () => {
    await insertUserNotificationConfig(readModelDB, reviewerConfig, 1);
    expect(await dispatch()).toEqual([]);
  });

  it("throws when the event has no purpose", async () => {
    await expect(dispatch({ ...event, data: {} })).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSigned")
    );
  });
});
