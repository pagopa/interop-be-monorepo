import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockPurpose,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
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

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposePublishedWithRiskAnalysisToReviewer } from "../src/handlers/purposes/handlePurposePublishedWithRiskAnalysisToReviewer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handlePurposePublishedWithRiskAnalysisToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUserId = generateId<UserId>();
  const purpose = {
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
  const eservice = {
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
      handlePurposePublishedWithRiskAnalysisToReviewer(
        undefined,
        logger,
        readModelService,
        "PurposeActivated"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeActivated")
    );
  });

  it.each(["PurposeActivated", "PurposeWaitingForApproval"] as const)(
    "should notify all current reviewers once for %s",
    async (type) => {
      mockGetNotificationRecipients.mockResolvedValue([
        ...reviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
        { userId: unrelatedUserId, tenantId: consumerId },
      ]);
      const decodedMessage: PurposeEventEnvelope = {
        event_version: 2,
        type,
        data: { purpose: toPurposeV2(purpose) },
        sequence_num: 1,
        stream_id: purposeId,
        version: 1,
        log_date: new Date(),
      };

      const notifications = await handlePurposeEvent(
        decodedMessage,
        logger,
        readModelService
      );

      expect(
        notifications.filter(
          ({ notificationType }) =>
            notificationType === "purposePublishedWithRiskAnalysisToReviewer"
        )
      ).toEqual(
        reviewerIds.map((userId) => ({
          userId,
          tenantId: consumerId,
          body: "L'amministratore ha pubblicato la finalità Finalità test associata all'e-service E-service test con analisi del rischio approvata da te.",
          notificationType: "purposePublishedWithRiskAnalysisToReviewer",
          entityId: purposeId,
        }))
      );
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
      handlePurposeEvent(decodedMessage, logger, readModelService)
    ).resolves.toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });
});
