/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockTenant,
  getMockValidRiskAnalysisForm,
  getMockDescriptorPublished,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  PurposeRiskAnalysisSubmittedV2,
  toPurposeV2,
  PurposeId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  ReviewerWorkflow,
  unsafeBrandId,
  TenantId,
  tenantKind,
  Tenant,
  EService,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  reviewerWorkflowNotFound,
  reviewerWorkflowNotSubmittable,
  submitNotAllowedForReviewMode,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";
import { buildRiskAnalysisFormSeed } from "../mockUtils.js";

describe("submitRiskAnalysis", () => {
  const mockTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const mockEService: EService = {
    ...getMockEService(),
    producerId: mockTenant.id,
    descriptors: [getMockDescriptorPublished()],
  };

  const validFormSeed = buildRiskAnalysisFormSeed(
    getMockValidRiskAnalysisForm(tenantKind.PA)
  );

  it("should write PurposeRiskAnalysisSubmitted on event-store for a purpose in Draft state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const workflow: ReviewerWorkflow = {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerIds: [unsafeBrandId(generateId())],
      signingState: riskAnalysisSigningState.draft,
      sentToReviewerAt: undefined,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: workflow,
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const { data: updatedPurpose } = await purposeService.submitRiskAnalysis(
      mockPurpose.id,
      { riskAnalysisForm: validFormSeed },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSubmitted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSubmittedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(updatedPurpose),
    });

    vi.useRealTimers();
  });

  it("should write PurposeRiskAnalysisSubmitted on event-store for a purpose in Rejected state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const workflow: ReviewerWorkflow = {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerIds: [unsafeBrandId(generateId())],
      signingState: riskAnalysisSigningState.rejected,
      rejectionReason: "some reason",
      sentToReviewerAt: new Date(),
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: workflow,
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const { data: updatedPurpose } = await purposeService.submitRiskAnalysis(
      mockPurpose.id,
      { riskAnalysisForm: validFormSeed },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSubmitted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSubmittedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(updatedPurpose),
    });

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    expect(
      purposeService.submitRiskAnalysis(
        randomId,
        { riskAnalysisForm: validFormSeed },
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
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it("should throw submitNotAllowedForReviewMode if review mode is ReviewerWritesReviewerSigns", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [unsafeBrandId(generateId())],
        signingState: riskAnalysisSigningState.draft,
        sentToReviewerAt: undefined,
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(submitNotAllowedForReviewMode(mockPurpose.id));
  });

  it("should throw reviewerWorkflowNotSubmittable if signing state is Submitted", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [unsafeBrandId(generateId())],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotSubmittable(mockPurpose.id));
  });

  it("should throw reviewerWorkflowNotSubmittable if signing state is Signed", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [unsafeBrandId(generateId())],
        signingState: riskAnalysisSigningState.signed,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotSubmittable(mockPurpose.id));
  });

  it("should throw reviewerWorkflowNotSubmittable if signing state is Assigned", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [unsafeBrandId(generateId())],
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: new Date(),
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotSubmittable(mockPurpose.id));
  });

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const workflow: ReviewerWorkflow = {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerIds: [unsafeBrandId(generateId())],
      signingState: riskAnalysisSigningState.draft,
      sentToReviewerAt: undefined,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: workflow,
    };

    await addOnePurpose(mockPurpose);

    const otherOrganizationId = generateId<TenantId>();

    expect(
      purposeService.submitRiskAnalysis(
        mockPurpose.id,
        { riskAnalysisForm: validFormSeed },
        getMockContext({ authData: getMockAuthData(otherOrganizationId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));
  });
});
