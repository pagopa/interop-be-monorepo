/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  PurposeRiskAnalysisWorkflowCreatedV2,
  PurposeRiskAnalysisAssignedV2,
  toPurposeV2,
  PurposeId,
  riskAnalysisReviewMode,
  RiskAnalysisSigningState,
  ReviewerWorkflow,
  unsafeBrandId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import {
  purposeNotFound,
  tenantIsNotTheConsumer,
  reviewerWorkflowConflict,
  multipleReviewersNotAllowed,
  userWithoutReviewerPrivileges,
  missingSelfcareId,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  addOneTenant,
  readLastPurposeEvent,
  purposeService,
  selfcareV2Client,
} from "../integrationUtils.js";

const mockSelfCareUser: selfcareV2ClientApi.UserResource = {
  id: generateId(),
  name: "test",
  roles: [],
  email: "test@test.it",
  surname: "surname_test",
};

function mockSelfcareV2ClientCall(
  value: Awaited<
    ReturnType<typeof selfcareV2Client.getInstitutionUsersByProductUsingGET>
  >
): void {
  selfcareV2Client.getInstitutionUsersByProductUsingGET = vi.fn(
    async () => value
  );
}

describe("assignRiskAnalysisReviewer", () => {
  it("should write on event-store for ReviewerWritesReviewerSigns mode (PurposeRiskAnalysisAssigned)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion = getMockPurposeVersion();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([mockPurposeVersion]),
      consumerId: mockTenant.id,
    };

    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerIds = [generateId()];

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisAssigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisAssignedV2,
      payload: writtenEvent.data,
    });

    const expectedReviewerWorkflow: ReviewerWorkflow = {
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerIds: reviewerIds.map((id) => unsafeBrandId(id)),
      signingState: RiskAnalysisSigningState.Values.Assigned,
      sentToReviewerAt: new Date(),
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });

    vi.useRealTimers();
  });

  it("should write on event-store for AdminWritesReviewerSigns mode (PurposeRiskAnalysisWorkflowCreated)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion = getMockPurposeVersion();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([mockPurposeVersion]),
      consumerId: mockTenant.id,
    };

    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerIds = [generateId<UserId>()];

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds,
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisWorkflowCreated",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisWorkflowCreatedV2,
      payload: writtenEvent.data,
    });

    const expectedReviewerWorkflow: ReviewerWorkflow = {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerIds: reviewerIds.map((id) => unsafeBrandId(id)),
      signingState: RiskAnalysisSigningState.Values.Draft,
      sentToReviewerAt: undefined,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();

    expect(
      purposeService.assignRiskAnalysisReviewer(
        randomId,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
    };

    await addOnePurpose(mockPurpose);

    const otherOrganizationId = generateId<TenantId>();

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData(otherOrganizationId) })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));
  });

  it("should throw reviewerWorkflowConflict if the purpose already has a reviewer workflow", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [unsafeBrandId(generateId())],
        signingState: RiskAnalysisSigningState.Values.Draft,
        sentToReviewerAt: undefined,
      },
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowConflict(mockPurpose.id));
  });

  it("should throw multipleReviewersNotAllowed if more than one reviewer are provided", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
    };

    await addOnePurpose(mockPurpose);

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId(), generateId()],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(multipleReviewersNotAllowed(mockPurpose.id));
  });

  it("should throw missingSelfcareId if the consumer tenant has no selfcareId", async () => {
    const mockTenant = { ...getMockTenant(), selfcareId: undefined };
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
    };

    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(missingSelfcareId(mockTenant.id));
  });

  it("should throw userWithoutReviewerPrivileges if the reviewer is not a reviewer in selfcare", async () => {
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
    };

    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerId = generateId<UserId>();

    mockSelfcareV2ClientCall([]);

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [reviewerId],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(
      userWithoutReviewerPrivileges(mockTenant.id, reviewerId)
    );
  });
});
