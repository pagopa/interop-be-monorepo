/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockExpiredRiskAnalysisForm,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockValidRiskAnalysisForm,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  EService,
  Purpose,
  PurposeId,
  PurposeRiskAnalysisSignedV2,
  Tenant,
  UserId,
  fromPurposeV2,
  generateId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  missingRiskAnalysis,
  purposeNotFound,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotInSubmittedState,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("signRiskAnalysis", () => {
  const mockTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const mockEService: EService = {
    ...getMockEService(),
  };

  it("should write PurposeRiskAnalysisSigned on event-store for ReviewerWritesReviewerSigns mode", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: new Date(),
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const {
      data: { purpose: updatedPurpose, isRiskAnalysisValid },
    } = await purposeService.signRiskAnalysis(
      mockPurpose.id,
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    expect(isRiskAnalysisValid).toBe(true);

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSignedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should write PurposeRiskAnalysisSigned on event-store for AdminWritesReviewerSigns mode", async () => {
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

    const {
      data: { purpose: updatedPurpose, isRiskAnalysisValid },
    } = await purposeService.signRiskAnalysis(
      mockPurpose.id,
      getMockContext({
        authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
      })
    );

    expect(isRiskAnalysisValid).toBe(true);

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSignedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    expect(
      purposeService.signRiskAnalysis(
        randomId,
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

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it("should throw reviewerWorkflowNotInSubmittedState if the workflow is not signable", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.draft,
        sentToReviewerAt: undefined,
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(reviewerWorkflowNotInSubmittedState(mockPurpose.id));
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

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        getMockContext({
          authData: getMockAuthData(
            mockPurpose.consumerId,
            generateId<UserId>()
          ),
        })
      )
    ).rejects.toThrowError(requesterIsNotDesignatedReviewer(mockPurpose.id));
  });

  it("should throw missingRiskAnalysis for ReviewerWritesReviewerSigns if the form is missing", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: new Date(),
      },
      riskAnalysisForm: undefined,
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
  });

  it("should throw riskAnalysisValidationFailed for ReviewerWritesReviewerSigns if the form is invalid", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      riskAnalysisForm: getMockExpiredRiskAnalysisForm(tenantKind.PA),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: new Date(),
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    await expect(
      purposeService.signRiskAnalysis(
        mockPurpose.id,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toMatchObject({ code: "riskAnalysisValidationFailed" });
  });
});
