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
  PurposeId,
  riskAnalysisSigningState,
  Tenant,
  TenantId,
  toPurposeV2,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handlePurposeRiskAnalysisSignedToReviewer } from "../src/handlers/purposes/handlePurposeRiskAnalysisSignedToReviewer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handlePurposeRiskAnalysisSignedToReviewer", () => {
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const purposeId = generateId<PurposeId>();
  const correlationId = generateId<CorrelationId>();
  const signedBy = generateId<UserId>();
  const otherReviewerIds = [generateId<UserId>(), generateId<UserId>()];
  const unrelatedUser = getMockUser(consumerId);
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    name: "E-service test",
  };
  const consumer: Tenant = getMockTenant(consumerId);
  const purpose: Purpose = {
    ...getMockPurpose(),
    id: purposeId,
    eserviceId,
    consumerId,
    title: "Finalità test",
    reviewerWorkflow: {
      reviewers: [signedBy, ...otherReviewerIds].map((id) => ({ id })),
      signingState: riskAnalysisSigningState.signed,
      signedBy,
    },
  };
  const event: PurposeEventEnvelope = {
    event_version: 2,
    type: "PurposeRiskAnalysisSigned",
    data: { purpose: toPurposeV2(purpose) },
    sequence_num: 1,
    stream_id: purposeId,
    version: 1,
    log_date: new Date(),
  };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(consumer);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation(
        (_tenantIds: TenantId[], _notificationType: NotificationType) => [
          {
            userId: signedBy,
            tenantId: consumerId,
            userRoles: [authRole.REVIEWER_ROLE],
          },
          ...otherReviewerIds.map((userId) => ({
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
      handlePurposeRiskAnalysisSignedToReviewer({
        purposeV2Msg: undefined,
        logger,
        templateService,
        readModelService,
        correlationId,
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("purpose", "PurposeRiskAnalysisSigned")
    );
  });

  it("should email assigned reviewers except the signer", async () => {
    const messages = await handlePurposeEvent({
      decodedMessage: event,
      logger,
      templateService,
      readModelService,
      correlationId,
    });

    expect(messages).toHaveLength(otherReviewerIds.length);
    expect(
      readModelService.getTenantUsersWithNotificationEnabled
    ).toHaveBeenCalledWith(
      [consumerId],
      "purposeRiskAnalysisSignedToReviewer",
      "email"
    );
    expect(
      messages.map((message) =>
        message.type === "User" ? message.userId : undefined
      )
    ).toEqual(otherReviewerIds);
    messages.forEach((message) => {
      expect(message.correlationId).toBe(correlationId);
      expect(message.email.subject).toBe(
        "L'analisi del rischio assegnata a te è già stata approvata"
      );
      expect(message.email.body.replace(/\s+/g, " ")).toContain(
        "L'analisi del rischio per la finalità Finalità test associata all'e-service E-service test che ti era stata assegnata è già stata approvata. Resterà comunque visibile nella sezione Analisi del rischio."
      );
    });
  });

  it("should not create messages when the signer is the only reviewer", async () => {
    const singleReviewerPurpose: Purpose = {
      ...purpose,
      reviewerWorkflow: {
        reviewers: [{ id: signedBy }],
        signingState: riskAnalysisSigningState.signed,
        signedBy,
      },
    };

    const messages = await handlePurposeEvent({
      decodedMessage: {
        ...event,
        data: { purpose: toPurposeV2(singleReviewerPurpose) },
      },
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
});
