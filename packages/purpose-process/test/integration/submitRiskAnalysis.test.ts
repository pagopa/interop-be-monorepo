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
      reviewers: [
        { id: unsafeBrandId(generateId()), sentToReviewerAt: undefined },
      ],
      signingState: riskAnalysisSigningState.draft,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
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

    expect(updatedPurpose.reviewerWorkflow?.reviewers).toEqual(
      workflow.reviewers.map((reviewer) => ({
        ...reviewer,
        sentToReviewerAt: new Date(),
      }))
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
    const now = new Date();
    vi.setSystemTime(now);

    const workflow: ReviewerWorkflow = {
      reviewers: [
        {
          id: unsafeBrandId(generateId()),
          sentToReviewerAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: unsafeBrandId(generateId()),
          sentToReviewerAt: new Date("2021-01-01T00:00:00.000Z"),
        },
      ],
      signingState: riskAnalysisSigningState.rejected,
      rejectedBy: unsafeBrandId(generateId()),
      rejectionReason: "some reason",
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
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

    expect(updatedPurpose.reviewerWorkflow?.reviewers).toEqual(
      workflow.reviewers.map((reviewer) => ({
        ...reviewer,
        sentToReviewerAt: now,
      }))
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

    expect(updatedPurpose.reviewerWorkflow?.rejectedBy).toBeUndefined();
    expect(updatedPurpose.reviewerWorkflow?.rejectionReason).toBeUndefined();

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
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [
          { id: unsafeBrandId(generateId()), sentToReviewerAt: undefined },
        ],
        signingState: riskAnalysisSigningState.draft,
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

  it.each([
    { signingState: riskAnalysisSigningState.assigned },
    { signingState: riskAnalysisSigningState.submitted },
    { signingState: riskAnalysisSigningState.signed },
  ])(
    "should throw reviewerWorkflowNotSubmittable if signing state is $signingState",
    async ({ signingState }) => {
      const mockPurpose: Purpose = {
        ...getMockPurpose([getMockPurposeVersion()]),
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerWorkflow: {
          reviewers: [
            { id: unsafeBrandId(generateId()), sentToReviewerAt: new Date() },
          ],
          signingState,
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
    }
  );

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const workflow: ReviewerWorkflow = {
      reviewers: [
        { id: unsafeBrandId(generateId()), sentToReviewerAt: undefined },
      ],
      signingState: riskAnalysisSigningState.draft,
    };

    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
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
