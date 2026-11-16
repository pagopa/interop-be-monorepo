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
  eventConflictError,
  fromPurposeV2,
  generateId,
  hyperlinkDetectionError,
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
  riskAnalysisAlreadyApproved,
  riskAnalysisAlreadyRejected,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  purposeService,
  postgresDB,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("rejectRiskAnalysis", () => {
  it("should write PurposeRiskAnalysisRejected on event-store", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
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

    expect(updatedPurpose.reviewerWorkflow?.rejectedBy).toEqual(reviewerId);
    expect(updatedPurpose.reviewerWorkflow?.rejectedAt).toEqual(new Date());

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

  it.each([
    riskAnalysisSigningState.submitted,
    riskAnalysisSigningState.signed,
    riskAnalysisSigningState.rejected,
  ])(
    "should check the consumer before workflow state %s",
    async (signingState) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
          signingState,
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

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it.each([riskAnalysisSigningState.draft, riskAnalysisSigningState.assigned])(
    "should throw reviewerWorkflowNotInSubmittedState for state %s",
    async (signingState) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId }],
          signingState,
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
      ).rejects.toThrowError(
        reviewerWorkflowNotInSubmittedState(mockPurpose.id)
      );

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it.each([
    {
      signingState: riskAnalysisSigningState.signed,
      expectedError: riskAnalysisAlreadyApproved,
    },
    {
      signingState: riskAnalysisSigningState.rejected,
      expectedError: riskAnalysisAlreadyRejected,
    },
  ])(
    "should report the corresponding terminal conflict for state $signingState",
    async ({ signingState, expectedError }) => {
      const reviewerId: UserId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerWorkflow: {
          reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
          signingState,
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
      ).rejects.toThrowError(expectedError(mockPurpose.id));

      expect(await readLastPurposeEvent(mockPurpose.id)).toMatchObject({
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

  it("should throw rejectNotAllowedInCurrentMode if the workflow mode is ReviewerWritesReviewerSigns", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode:
        riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
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
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: generateId<UserId>(), sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
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

  it("should throw hyperlinkDetectionError when the rejectionReason contains a hyperlink", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
      },
    };

    await addOnePurpose(mockPurpose);

    const rejectionReason = "see https://evil.example.com";

    await expect(
      purposeService.rejectRiskAnalysis(
        mockPurpose.id,
        { rejectionReason },
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(hyperlinkDetectionError(rejectionReason));
  });

  it("should propagate an event-store conflict without writing another event", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      riskAnalysisReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: new Date() }],
        signingState: riskAnalysisSigningState.submitted,
      },
    };
    const context = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
    });
    const rejectionSeed = {
      rejectionReason: "This risk analysis is incomplete and needs revision",
    };

    await addOnePurpose(mockPurpose);
    await purposeService.rejectRiskAnalysis(
      mockPurpose.id,
      rejectionSeed,
      context
    );
    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    // The readmodel still has version 0 after the first event-store write.
    const writeTransaction = vi.spyOn(postgresDB, "tx");
    try {
      await expect(
        purposeService.rejectRiskAnalysis(
          mockPurpose.id,
          rejectionSeed,
          context
        )
      ).rejects.toThrowError(
        eventConflictError(context.correlationId, mockPurpose.id, 0)
      );
      expect(writeTransaction).toHaveBeenCalledOnce();
    } finally {
      writeTransaction.mockRestore();
    }

    expect(await readLastPurposeEvent(mockPurpose.id)).toEqual(writtenEvent);
  });
});
