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
  riskAnalysisSigningState,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisAssignedForSigningToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisAssignedForSigningToReviewer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handlePurposeRiskAnalysisAssignedForSigningToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUserId = generateId<UserId>();

  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    name: "E-service test",
    descriptors: [getMockDescriptorPublished()],
  };
  const producer = {
    ...getMockTenant(producerId),
    name: "Ente erogatore",
  };
  const consumer = getMockTenant(consumerId);
  const purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
  };
  const body =
    "L'ente Ente erogatore ti ha assegnato un'analisi del rischio da approvare per la finalità Finalità test associata all'e-service E-service test.";
  const { logger } = getMockContext({});
  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
  });

  it("should throw when purpose is missing", async () => {
    await expect(
      handlePurposeRiskAnalysisAssignedForSigningToReviewer(
        undefined,
        reviewerIds,
        logger,
        readModelService,
        "PurposeRiskAnalysisSubmitted"
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSubmitted")
    );
  });

  it("should not create notifications when there are no reviewers to notify", async () => {
    const notifications =
      await handlePurposeRiskAnalysisAssignedForSigningToReviewer(
        toPurposeV2(purpose),
        [],
        logger,
        readModelService,
        "PurposeRiskAnalysisWorkflowCreated"
      );

    expect(notifications).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });

  it("should notify only newReviewersToNotify for a workflow-created event", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      ...reviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
      { userId: unrelatedUserId, tenantId: consumerId },
    ]);

    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "PurposeRiskAnalysisWorkflowCreated",
      data: {
        purpose: toPurposeV2(purpose),
        newReviewersToNotify: reviewerIds,
        oldReviewersToNotify: [unrelatedUserId],
      },
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

    expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
      [consumerId],
      "purposeRiskAnalysisAssignedForSigningToReviewer",
      readModelService,
      logger
    );
    expect(notifications).toEqual(
      reviewerIds.map((userId) => ({
        userId,
        tenantId: consumerId,
        body,
        notificationType:
          "purposeRiskAnalysisAssignedForSigningToReviewer" as const,
        entityId: purposeId,
      }))
    );
  });

  it("should notify all current reviewers for a submitted event", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      ...reviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
      { userId: unrelatedUserId, tenantId: consumerId },
    ]);
    const purposeWithReviewers = {
      ...purpose,
      reviewerWorkflow: {
        reviewers: reviewerIds.map((id) => ({ id })),
        signingState: riskAnalysisSigningState.submitted,
      },
    };
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "PurposeRiskAnalysisSubmitted",
      data: { purpose: toPurposeV2(purposeWithReviewers) },
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

    expect(notifications).toEqual(
      reviewerIds.map((userId) => ({
        userId,
        tenantId: consumerId,
        body,
        notificationType:
          "purposeRiskAnalysisAssignedForSigningToReviewer" as const,
        entityId: purposeId,
      }))
    );
  });
});
