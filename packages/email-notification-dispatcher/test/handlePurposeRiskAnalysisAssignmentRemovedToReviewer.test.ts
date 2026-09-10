/* eslint-disable functional/immutable-data */
import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
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
  Tenant,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisAssignmentRemovedToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisAssignmentRemovedToReviewer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handlePurposeRiskAnalysisAssignmentRemovedToReviewer", () => {
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const correlationId = generateId<CorrelationId>();
  const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUser = getMockUser(consumerId);
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    name: "E-service test",
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
    await addOneTenant(consumer);
    await addOneTenant(getMockTenant(eservice.producerId));
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
      handlePurposeRiskAnalysisAssignmentRemovedToReviewer({
        purposeV2Msg: undefined,
        reviewerIds,
        eventType: "PurposeRiskAnalysisAssigned",
        logger,
        templateService,
        readModelService,
        correlationId,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisAssigned")
    );
  });

  it("should not create messages when there are no reviewers to notify", async () => {
    const messages = await handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
      {
        purposeV2Msg: toPurposeV2(purpose),
        reviewerIds: [],
        eventType: "PurposeRiskAnalysisSelfAssigned",
        logger,
        templateService,
        readModelService,
        correlationId,
      }
    );

    expect(messages).toEqual([]);
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).not.toHaveBeenCalled();
  });

  const events: Array<{ name: string; event: PurposeEventEnvelope }> = [
    {
      name: "self-assigned",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisSelfAssigned",
        data: {
          purpose: toPurposeV2(purpose),
          oldReviewersToNotify: reviewerIds,
        },
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        log_date: new Date(),
      },
    },
    {
      name: "workflow-created",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisWorkflowCreated",
        data: {
          purpose: toPurposeV2(purpose),
          newReviewersToNotify: [unrelatedUser.id],
          oldReviewersToNotify: reviewerIds,
        },
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        log_date: new Date(),
      },
    },
    {
      name: "assigned",
      event: {
        event_version: 2,
        type: "PurposeRiskAnalysisAssigned",
        data: {
          purpose: toPurposeV2(purpose),
          newReviewersToNotify: [unrelatedUser.id],
          oldReviewersToNotify: reviewerIds,
        },
        sequence_num: 1,
        stream_id: purpose.id,
        version: 1,
        log_date: new Date(),
      },
    },
  ];

  it.each(events)(
    "should email only oldReviewersToNotify for a $name event",
    async ({ event }) => {
      const allMessages = await handlePurposeEvent({
        decodedMessage: event,
        logger,
        templateService,
        readModelService,
        correlationId,
      });
      const messages = allMessages.filter(
        (message) =>
          message.email.subject ===
          "L'assegnazione dell'analisi del rischio è stata rimossa"
      );

      expect(messages).toHaveLength(reviewerIds.length);
      expect(
        readModelService.getTenantUsersWithNotificationEnabled
      ).toHaveBeenCalledWith(
        [consumerId],
        "purposeRiskAnalysisAssignmentRemovedToReviewer",
        "email"
      );
      expect(
        messages.map((message) =>
          message.type === "User" ? message.userId : undefined
        )
      ).toEqual(reviewerIds);
      messages.forEach((message) => {
        expect(message.correlationId).toBe(correlationId);
        expect(message.email.subject).toBe(
          "L'assegnazione dell'analisi del rischio è stata rimossa"
        );
        expect(message.email.body.replace(/\s+/g, " ")).toContain(
          "L'amministratore ha rimosso l'assegnazione dell'analisi del rischio per la finalità Finalità test associata all'e-service E-service test. Non la vedrai più nella sezione Analisi del rischio."
        );
      });
    }
  );
});
