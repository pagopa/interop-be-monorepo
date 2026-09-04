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
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

describe("handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unchangedReviewerId = generateId<UserId>();
  const removedReviewerId = generateId<UserId>();

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
    "L'ente Ente erogatore ti ha assegnato un'analisi del rischio da compilare e approvare per la finalità Finalità test associata all'e-service E-service test.";
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
      handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer(
        undefined,
        reviewerIds,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisAssigned")
    );
  });

  it("should not create notifications when there are no reviewers to notify", async () => {
    const notifications =
      await handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer(
        toPurposeV2(purpose),
        [],
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });

  it("should notify each new reviewer once and ignore unchanged and removed reviewers", async () => {
    mockGetNotificationRecipients.mockResolvedValue([
      ...reviewerIds.map((userId) => ({ userId, tenantId: consumerId })),
      { userId: unchangedReviewerId, tenantId: consumerId },
      { userId: removedReviewerId, tenantId: consumerId },
    ]);

    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "PurposeRiskAnalysisAssigned",
      data: {
        purpose: toPurposeV2(purpose),
        newReviewersToNotify: reviewerIds,
        oldReviewersToNotify: [removedReviewerId],
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
      "purposeRiskAnalysisAssignedForWritingAndSigningToReviewer",
      readModelService,
      logger
    );
    expect(notifications).toEqual(
      reviewerIds.map((userId) => ({
        userId,
        tenantId: consumerId,
        body,
        notificationType:
          "purposeRiskAnalysisAssignedForWritingAndSigningToReviewer" as const,
        entityId: purposeId,
      }))
    );
  });
});
