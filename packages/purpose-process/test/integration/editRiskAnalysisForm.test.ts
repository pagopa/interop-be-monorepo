/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockEService,
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
  PurposeRiskAnalysisFormEditedV2,
  Tenant,
  TenantId,
  UserId,
  fromPurposeV2,
  generateId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  editNotAllowedForReviewMode,
  purposeNotFound,
  requesterIsNotDesignatedReviewer,
  reviewerWorkflowNotEditable,
  reviewerWorkflowNotFound,
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

describe("editRiskAnalysisForm", () => {
  const mockTenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const mockEService: EService = {
    ...getMockEService(),
  };

  it("should write PurposeRiskAnalysisFormEdited on event-store", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
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

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    const { data: updatedPurpose } =
      await purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      );

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisFormEdited",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisFormEditedV2,
      payload: writtenEvent.data,
    });

    expect(sortPurpose(fromPurposeV2(writtenPayload.purpose!))).toEqual(
      sortPurpose(updatedPurpose)
    );

    vi.useRealTimers();
  });

  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        randomId,
        riskAnalysisFormSeed,
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrowError(purposeNotFound(randomId));
  });

  it("should throw reviewerWorkflowNotFound if the purpose has no reviewer workflow", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: undefined,
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewerWorkflowNotFound(mockPurpose.id));
  });

  it("should throw editNotAllowedForReviewMode if the workflow mode is AdminWritesReviewerSigns", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.draft,
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(editNotAllowedForReviewMode(mockPurpose.id));
  });

  it("should throw reviewerWorkflowNotEditable if the workflow is not in Assigned state", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.signed,
        signedBy: reviewerId,
        sentToReviewerAt: new Date(),
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(mockPurpose.consumerId, reviewerId),
        })
      )
    ).rejects.toThrowError(reviewerWorkflowNotEditable(mockPurpose.id));
  });

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const reviewerId: UserId = generateId();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
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

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    const otherOrganizationId = generateId<TenantId>();

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(otherOrganizationId, reviewerId),
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(otherOrganizationId));
  });

  it("should throw requesterIsNotDesignatedReviewer if the requester is not in reviewerIds", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      consumerId: mockTenant.id,
      eserviceId: mockEService.id,
      reviewerWorkflow: {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds: [generateId<UserId>()],
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: new Date(),
      },
    };

    await addOneTenant(mockTenant);
    await addOneEService(mockEService);
    await addOnePurpose(mockPurpose);

    const riskAnalysisFormSeed = buildRiskAnalysisFormSeed(
      getMockValidRiskAnalysisForm(tenantKind.PA)
    );

    await expect(
      purposeService.editRiskAnalysisForm(
        mockPurpose.id,
        riskAnalysisFormSeed,
        getMockContext({
          authData: getMockAuthData(
            mockPurpose.consumerId,
            generateId<UserId>()
          ),
        })
      )
    ).rejects.toThrowError(
      requesterIsNotDesignatedReviewer(mockPurpose.id)
    );
  });
});
