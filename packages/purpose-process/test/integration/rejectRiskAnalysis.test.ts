/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockPurpose,
  getMockPurposeVersion,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  PurposeId,
  PurposeRiskAnalysisRejectedV2,
  TenantId,
  UserId,
  fromPurposeV2,
  generateId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  rejectNotAllowedInCurrentMode,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInSubmittedState,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("rejectRiskAnalysis", () => {
  it("should write PurposeRiskAnalysisRejected on event-store", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    const { data: updatedPurpose } = await purposeService.rejectRiskAnalysis(
      mockPurpose.id,
      {
        rejectionReason: "This risk analysis is incomplete and needs revision",
      },
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisRejected",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisRejectedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    await expect(
      purposeService.rejectRiskAnalysis(
        randomId,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });

  it("should throw reviewerWorkflowNotFound if the purpose has no reviewer workflow", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: undefined,
    };

    await addOnePurpose(mockPurpose);

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    const otherOrganizationId = generateId<TenantId>();

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({
          authData: getMockAuthData(otherOrganizationId, reviewerId),
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));
  });

  it("should throw reviewerWorkflowNotInSubmittedState if the workflow is not in Submitted state", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.draft,
      },
    };

    await addOnePurpose(mockPurpose);

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(reviewerWorkflowNotInSubmittedState(mockPurpose.id));
  });

  it("should throw rejectNotAllowedInCurrentMode if the workflow mode is ReviewerWritesReviewerSigns", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(rejectNotAllowedInCurrentMode(mockPurpose.id));
  });

  it("should throw requesterIsNotDesignatedReviewer if the requester is not in reviewerIds", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [generateId<UserId>()],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        {
          rejectionReason:
            "This risk analysis is incomplete and needs revision",
        },
        getMockContext({
          authData: getMockAuthData(
            mockPurpose.consumerId,
            generateId<UserId>()
          ),
        })
      )
    ).rejects.toThrowError(requesterIsNotDesignatedReviewer(mockPurpose.id));
  });
});
