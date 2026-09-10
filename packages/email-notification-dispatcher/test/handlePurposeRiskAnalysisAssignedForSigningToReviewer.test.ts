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
  riskAnalysisSigningState,
  Tenant,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisAssignedForSigningToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisAssignedForSigningToReviewer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handlePurposeRiskAnalysisAssignedForSigningToReviewer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const correlationId = generateId<CorrelationId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUser = getMockUser(consumerId);

  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    name: "E-service test",
    descriptors: [getMockDescriptorPublished()],
  };
  const producer: Tenant = {
    ...getMockTenant(producerId),
    name: "Ente erogatore",
  };
  const consumer: Tenant = getMockTenant(consumerId);
  const purpose: Purpose = {
    ...getMockPurpose(),
    eserviceId,
    consumerId,
    title: "Finalità test",
  };
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
      handlePurposeRiskAnalysisAssignedForSigningToReviewer({
        purposeV2Msg: undefined,
        reviewerIds,
        eventType: "PurposeRiskAnalysisSubmitted",
        logger,
        templateService,
        readModelService,
        correlationId,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSubmitted")
    );
  });

  it("should not create messages when there are no reviewers to notify", async () => {
    const messages =
      await handlePurposeRiskAnalysisAssignedForSigningToReviewer({
        purposeV2Msg: toPurposeV2(purpose),
        reviewerIds: [],
        eventType: "PurposeRiskAnalysisWorkflowCreated",
        logger,
        templateService,
        readModelService,
        correlationId,
      });

    expect(messages).toEqual([]);
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).not.toHaveBeenCalled();
  });

  it("should create a complete email for all current reviewers on submission", async () => {
    const purposeWithReviewers: Purpose = {
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
      stream_id: purpose.id,
      version: 1,
      log_date: new Date(),
    };
    const messages = await handlePurposeEvent({
      decodedMessage,
      logger,
      templateService,
      readModelService,
      correlationId,
    });

    expect(messages).toHaveLength(reviewerIds.length);
    expect(messages.map((message) => message.type)).toEqual(["User", "User"]);
    expect(
      messages.map((message) =>
        message.type === "User" ? message.userId : undefined
      )
    ).toEqual(reviewerIds);
    messages.forEach((message) => {
      expect(message.correlationId).toBe(correlationId);
      expect(message.email.subject).toBe(
        "Hai un'analisi del rischio da approvare"
      );
      expect(message.email.body.replace(/\s+/g, " ")).toContain(
        "L'ente Ente erogatore ti ha assegnato un'analisi del rischio da approvare per la finalità Finalità test associata all'e-service E-service test. La trovi nella sezione Analisi del rischio."
      );
    });
  });

  it("should email only newReviewersToNotify for a workflow-created event", async () => {
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 2,
      type: "PurposeRiskAnalysisWorkflowCreated",
      data: {
        purpose: toPurposeV2(purpose),
        newReviewersToNotify: reviewerIds,
        oldReviewersToNotify: [unrelatedUser.id],
      },
      sequence_num: 1,
      stream_id: purpose.id,
      version: 1,
      log_date: new Date(),
    };

    const messages = await handlePurposeEvent({
      decodedMessage,
      logger,
      templateService,
      readModelService,
      correlationId,
    });

    expect(messages).toHaveLength(reviewerIds.length);
    expect(
      messages.map((message) =>
        message.type === "User" ? message.userId : undefined
      )
    ).toEqual(reviewerIds);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "Hai un'analisi del rischio da approvare"
      );
      expect(message.email.body.replace(/\s+/g, " ")).toContain(
        "L'ente Ente erogatore ti ha assegnato un'analisi del rischio da approvare per la finalità Finalità test associata all'e-service E-service test. La trovi nella sezione Analisi del rischio."
      );
    });
  });
});
