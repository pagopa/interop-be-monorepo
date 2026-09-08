import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockTenantMail,
  getMockTenantNotificationConfig,
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
import {
  insertUserNotificationConfig,
  insertTenantNotificationConfig,
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
  const { logger, correlationId } = getMockContext({});
  const dispatch = (decodedMessage: PurposeEventEnvelope = event) =>
    handlePurposeEvent({
      decodedMessage,
      logger,
      correlationId,
      readModelService,
      templateService,
    });

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
      expect(
        notifications
          .map((n) => (n.type === "User" ? n.userId : undefined))
          .sort()
      ).toEqual([adminConfig.userId, secondAdmin.userId].sort());
      for (const notification of notifications) {
        expect(notification).toMatchObject({
          type: "User",
          tenantId: consumer.id,
          correlationId,
        });
        expect(notification.email.subject).toBe(
          "Un'analisi del rischio è stata approvata"
        );
        expect(notification.email.body).toContain(
          "L'analisi del rischio per la finalità"
        );
        expect(notification.email.body).toContain(purpose.title);
        expect(notification.email.body).toContain(eservice.name);
        expect(notification.email.body).toContain(
          "è stata approvata. Ora puoi pubblicare la finalità."
        );
        expect(notification.email.body).toContain(notificationType);
        expect(notification.email.body).toContain(purpose.id);
        expect(notification.email.body).toContain("Visualizza finalità");
        expect(notification.email.body).toContain("{{ recipientName }}");
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
          emailNotificationPreference: preference !== "channel",
          emailConfig: {
            ...adminConfig.emailConfig,
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
