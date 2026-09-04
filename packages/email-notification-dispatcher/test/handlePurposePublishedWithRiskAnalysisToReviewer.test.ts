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

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposePublishedWithRiskAnalysisToReviewer } from "../src/handlers/purposes/handlePurposePublishedWithRiskAnalysisToReviewer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handlePurposePublishedWithRiskAnalysisToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const correlationId = generateId<CorrelationId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUser = getMockUser(consumerId);
  const purpose: Purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
    reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    reviewerWorkflow: {
      reviewers: reviewerIds.map((id) => ({ id })),
      signingState: riskAnalysisSigningState.signed,
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
          ...reviewerIds.map((userId) => ({
            userId,
            tenantId: consumerId,
            userRoles: [authRole.REVIEWER_ROLE],
          })),
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
      handlePurposePublishedWithRiskAnalysisToReviewer({
        purposeV2Msg: undefined,
        eventType: "PurposeActivated",
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeActivated")
    );
  });

  it.each(["PurposeActivated", "PurposeWaitingForApproval"] as const)(
    "should email all current reviewers once for %s",
    async (type) => {
      const decodedMessage: PurposeEventEnvelope = {
        event_version: 2,
        type,
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

      const publicationMessages = messages.filter(
        (message) =>
          message.email.subject ===
          "Finalità pubblicata con analisi del rischio assegnata a te"
      );
      expect(publicationMessages).toHaveLength(reviewerIds.length);
      expect(
        publicationMessages.map((message) =>
          message.type === "User" ? message.userId : undefined
        )
      ).toEqual(reviewerIds);
      publicationMessages.forEach((message) => {
        expect(message.email.subject).toBe(
          "Finalità pubblicata con analisi del rischio assegnata a te"
        );
        expect(message.email.body.replace(/\s+/g, " ")).toContain(
          "L'amministratore ha pubblicato la finalità Finalità test associata all'e-service E-service test con analisi del rischio che ti era stata assegnata."
        );
      });
    }
  );

  it("should not query recipients when the purpose has no reviewers", async () => {
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "PurposeActivated",
      data: {
        purpose: toPurposeV2({ ...purpose, reviewerWorkflow: undefined }),
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
