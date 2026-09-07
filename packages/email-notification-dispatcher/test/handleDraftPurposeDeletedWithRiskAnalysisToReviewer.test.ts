/* eslint-disable functional/immutable-data */
import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Purpose,
  PurposeEventEnvelope,
  PurposeId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  Tenant,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleDraftPurposeDeletedWithRiskAnalysisToReviewer } from "../src/handlers/purposes/handleDraftPurposeDeletedWithRiskAnalysisToReviewer.js";
import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleDraftPurposeDeletedWithRiskAnalysisToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const correlationId = generateId<CorrelationId>();
  const notifiedReviewerId = generateId<UserId>();
  const unnotifiedReviewerId = generateId<UserId>();
  const unrelatedUser = getMockUser(consumerId);
  const purpose: Purpose = {
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
  };
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    name: "E-service test",
    descriptors: [getMockDescriptorPublished()],
  };
  const producer: Tenant = getMockTenant(producerId);
  const consumer: Tenant = getMockTenant(consumerId);
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation(
        (_tenantIds: TenantId[], _notificationType: NotificationType) => [
          {
            userId: notifiedReviewerId,
            tenantId: consumerId,
            userRoles: [authRole.REVIEWER_ROLE],
          },
          {
            userId: unnotifiedReviewerId,
            tenantId: consumerId,
            userRoles: [authRole.REVIEWER_ROLE],
          },
          {
            userId: unrelatedUser.id,
            tenantId: consumerId,
            userRoles: [authRole.REVIEWER_ROLE],
          },
        ]
      );
  });

  it("should throw when purpose is missing", async () => {
    await expect(
      handleDraftPurposeDeletedWithRiskAnalysisToReviewer({
        purposeV2Msg: undefined,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "DraftPurposeDeleted")
    );
  });

  it("should email only reviewers previously informed of the assignment", async () => {
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "DraftPurposeDeleted",
      data: { purpose: toPurposeV2(purpose) },
      sequence_num: 1,
      stream_id: purposeId,
      version: 1,
      log_date: new Date(),
    };

    const messages = await handlePurposeEvent({
      decodedMessage,
      logger,
      readModelService,
      templateService,
      correlationId,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("User");
    expect(messages[0].type === "User" && messages[0].userId).toBe(
      notifiedReviewerId
    );
    expect(messages[0].email.subject).toBe(
      "Finalità eliminata con analisi del rischio assegnata a te"
    );
    expect(messages[0].email.body.replace(/\s+/g, " ")).toContain(
      "L'amministratore ha eliminato la finalità Finalità test associata all'e-service E-service test con analisi del rischio che ti era stata assegnata. Non la vedrai più nella sezione Analisi del rischio."
    );
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(
      [consumerId],
      "draftPurposeDeletedWithRiskAnalysisToReviewer",
      "email"
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
            reviewers: [{ id: unnotifiedReviewerId }],
            signingState: riskAnalysisSigningState.draft,
          },
        }),
      },
      sequence_num: 1,
      stream_id: purposeId,
      version: 1,
      log_date: new Date(),
    };

    await expect(
      handlePurposeEvent({
        decodedMessage,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    ).resolves.toEqual([]);
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).not.toHaveBeenCalled();
  });
});
