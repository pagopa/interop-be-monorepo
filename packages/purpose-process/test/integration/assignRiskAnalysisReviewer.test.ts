/* eslint-disable @typescript-eslint/no-floating-promises */
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { userRole } from "pagopa-interop-commons";
import {
  getMockPurposeVersion,
  getMockPurpose,
  getMockEService,
  decodeProtobufPayload,
  getMockAuthData,
  getMockContext,
  getMockTenant,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  generateId,
  PurposeRiskAnalysisWorkflowCreatedV2,
  PurposeRiskAnalysisAssignedV2,
  PurposeRiskAnalysisSelfAssignedV2,
  toPurposeV2,
  PurposeId,
  PurposeTemplateId,
  DelegationId,
  purposeVersionState,
  riskAnalysisReviewMode,
  RiskAnalysisReviewMode,
  RiskAnalysisSigningState,
  ReviewerWorkflow,
  PurposeRiskAnalysisForm,
  eserviceMode,
  unsafeBrandId,
  tenantKind,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { describe, expect, it, vi } from "vitest";

import {
  purposeNotFound,
  tenantIsNotTheConsumer,
  userWithoutReviewerPrivileges,
  missingSelfcareId,
  missingReviewers,
  reviewersNotAllowedForReviewMode,
  purposeFromTemplateCannotBeModified,
  purposeNotInDraftState,
  reviewerWorkflowConflict,
  reviewerWorkflowNotAllowedForDelegatedPurpose,
  reviewerWorkflowNotAllowedForReceiveMode,
} from "../../src/model/domain/errors.js";
import {
  addOnePurpose,
  addOneTenant,
  addOneEService,
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

/**
 * Reviewer sets shared by the transition tests: the request keeps one reviewer,
 * drops another and adds a new one, so that the `newReviewers` / `oldReviewers`
 * carried by the events can be told apart from the plain reviewer lists.
 */
const keptReviewerId = generateId<UserId>();
const removedReviewerId = generateId<UserId>();
const addedReviewerId = generateId<UserId>();
const previousReviewerIds = [keptReviewerId, removedReviewerId];
const requestedReviewerIds = [keptReviewerId, addedReviewerId];

const previousSentToReviewerAt = new Date("2020-01-01T00:00:00.000Z");

// AdminWritesAdminSigns is the only mode that accepts an empty reviewer list.
const reviewersFor = (reviewMode: RiskAnalysisReviewMode): UserId[] =>
  reviewMode === riskAnalysisReviewMode.adminWritesAdminSigns
    ? []
    : requestedReviewerIds;

/**
 * The workflow a purpose has while sitting in a given review mode: both
 * AdminWritesAdminSigns and the never assigned purpose have no workflow.
 */
function previousReviewerWorkflow(
  previousReviewMode: RiskAnalysisReviewMode | undefined,
  previousReviewers: UserId[]
): ReviewerWorkflow | undefined {
  return match(previousReviewMode)
    .returnType<ReviewerWorkflow | undefined>()
    .with(riskAnalysisReviewMode.reviewerWritesReviewerSigns, () => ({
      reviewers: previousReviewers.map((id) => ({
        id,
        sentToReviewerAt: previousSentToReviewerAt,
      })),
      signingState: RiskAnalysisSigningState.Values.Assigned,
      sentToReviewerAt: previousSentToReviewerAt,
    }))
    .with(riskAnalysisReviewMode.adminWritesReviewerSigns, () => ({
      reviewers: previousReviewers.map((id) => ({
        id,
        sentToReviewerAt: undefined,
      })),
      signingState: RiskAnalysisSigningState.Values.Draft,
      sentToReviewerAt: undefined,
    }))
    .with(
      riskAnalysisReviewMode.adminWritesAdminSigns,
      P.nullish,
      () => undefined
    )
    .exhaustive();
}

async function addPurposeInReviewMode({
  previousReviewMode,
  previousReviewers,
  riskAnalysisForm,
}: {
  previousReviewMode: RiskAnalysisReviewMode | undefined;
  previousReviewers: UserId[];
  riskAnalysisForm?: PurposeRiskAnalysisForm;
}): Promise<Purpose> {
  const mockEService = getMockEService();
  const mockTenant = getMockTenant();

  const mockPurpose: Purpose = {
    ...getMockPurpose([getMockPurposeVersion()]),
    eserviceId: mockEService.id,
    consumerId: mockTenant.id,
    riskAnalysisForm,
    reviewMode: previousReviewMode,
    reviewerWorkflow: previousReviewerWorkflow(
      previousReviewMode,
      previousReviewers
    ),
  };

  await addOneEService(mockEService);
  await addOneTenant(mockTenant);
  await addOnePurpose(mockPurpose);

  mockSelfcareV2ClientCall([mockSelfCareUser]);

  return mockPurpose;
}

describe("assignRiskAnalysisReviewer", () => {
  it("should write on event-store for ReviewerWritesReviewerSigns mode (PurposeRiskAnalysisAssigned)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion = getMockPurposeVersion();
    const mockEService = getMockEService();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([mockPurposeVersion]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerIds = [generateId()];

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    const ctx = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId),
    });

    await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds,
      },
      ctx
    );

    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).toHaveBeenCalledWith({
      params: { institutionId: mockTenant.selfcareId },
      queries: {
        userId: reviewerIds[0],
        productRoles: userRole.REVIEWER_ROLE,
      },
      headers: {
        "X-Correlation-Id": ctx.correlationId,
      },
    });

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
      reviewers: reviewerIds.map((id) => ({
        id: unsafeBrandId(id),
        sentToReviewerAt: new Date(),
      })),
      signingState: RiskAnalysisSigningState.Values.Assigned,
      sentToReviewerAt: undefined,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      newReviewers: reviewerIds,
      oldReviewers: [],
    });

    vi.useRealTimers();
  });

  it("should write on event-store for AdminWritesReviewerSigns mode (PurposeRiskAnalysisWorkflowCreated)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion = getMockPurposeVersion();
    const mockEService = getMockEService();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([mockPurposeVersion]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerIds = [generateId<UserId>()];

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    const ctx = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId),
    });

    await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        reviewerIds,
      },
      ctx
    );

    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).toHaveBeenCalledWith({
      params: { institutionId: mockTenant.selfcareId },
      queries: {
        userId: reviewerIds[0],
        productRoles: userRole.REVIEWER_ROLE,
      },
      headers: {
        "X-Correlation-Id": ctx.correlationId,
      },
    });

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
      reviewers: reviewerIds.map((id) => ({
        id: unsafeBrandId(id),
        sentToReviewerAt: undefined,
      })),
      signingState: RiskAnalysisSigningState.Values.Draft,
      sentToReviewerAt: undefined,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      newReviewers: reviewerIds,
      oldReviewers: [],
    });

    vi.useRealTimers();
  });

  it("should write on event-store when multiple reviewers are assigned", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurposeVersion = getMockPurposeVersion();
    const mockEService = getMockEService();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([mockPurposeVersion]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    const reviewerIds = [generateId<UserId>(), generateId<UserId>()];

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    const ctx = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId),
    });

    await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
        reviewerIds,
      },
      ctx
    );

    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).toHaveBeenCalledTimes(reviewerIds.length);

    reviewerIds.forEach((reviewerId) => {
      expect(
        selfcareV2Client.getInstitutionUsersByProductUsingGET
      ).toHaveBeenCalledWith({
        params: { institutionId: mockTenant.selfcareId },
        queries: {
          userId: reviewerId,
          productRoles: userRole.REVIEWER_ROLE,
        },
        headers: {
          "X-Correlation-Id": ctx.correlationId,
        },
      });
    });

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
      reviewers: reviewerIds.map((id) => ({
        id: unsafeBrandId(id),
        sentToReviewerAt: new Date(),
      })),
      signingState: RiskAnalysisSigningState.Values.Assigned,
      sentToReviewerAt: undefined,
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      newReviewers: reviewerIds,
      oldReviewers: [],
    });

    vi.useRealTimers();
  });

  it.each([
    {
      description: "never assigned -> ReviewerWritesReviewerSigns",
      previousReviewMode: undefined,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      description: "AdminWritesAdminSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      description: "AdminWritesReviewerSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
    },
  ])(
    "should reset the risk analysis form when the writer changes ($description)",
    async ({ previousReviewMode, requestedReviewMode }) => {
      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers: previousReviewerIds,
        riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
      });

      const { data: updatedPurpose } =
        await purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          {
            reviewMode: requestedReviewMode,
            reviewerIds: reviewersFor(requestedReviewMode),
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        );

      expect(updatedPurpose.riskAnalysisForm).toBeUndefined();
    }
  );

  it.each([
    {
      description: "never assigned -> AdminWritesAdminSigns",
      previousReviewMode: undefined,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
    },
    {
      description: "never assigned -> AdminWritesReviewerSigns",
      previousReviewMode: undefined,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      description: "AdminWritesAdminSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      description: "AdminWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      description: "AdminWritesReviewerSigns -> AdminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
    },
    {
      description: "ReviewerWritesReviewerSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
  ])(
    "should keep the risk analysis form when the writer does not change ($description)",
    async ({ previousReviewMode, requestedReviewMode }) => {
      const riskAnalysisForm = getMockValidRiskAnalysisForm(tenantKind.PA);
      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers: previousReviewerIds,
        riskAnalysisForm,
      });

      const { data: updatedPurpose } =
        await purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          {
            reviewMode: requestedReviewMode,
            reviewerIds: reviewersFor(requestedReviewMode),
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        );

      expect(updatedPurpose.riskAnalysisForm).toEqual(riskAnalysisForm);
    }
  );

  it("should reset the risk analysis form when the workflow is removed from ReviewerWritesReviewerSigns", async () => {
    const mockPurpose = await addPurposeInReviewMode({
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      riskAnalysisForm: getMockValidRiskAnalysisForm(tenantKind.PA),
    });

    const { data: updatedPurpose } =
      await purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
          reviewerIds: [],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

    expect(updatedPurpose.riskAnalysisForm).toBeUndefined();
    expect(updatedPurpose.reviewerWorkflow).toBeUndefined();

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSelfAssigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSelfAssignedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose?.riskAnalysisForm).toBeUndefined();
    expect(writtenPayload.oldReviewers).toEqual(
      mockPurpose.reviewerWorkflow?.reviewers.map((reviewer) => reviewer.id)
    );
  });

  it.each([
    {
      description: "never assigned -> AdminWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: [],
    },
    {
      description: "AdminWritesAdminSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: [],
    },
    {
      description: "AdminWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      expectedNewReviewers: [addedReviewerId],
      expectedOldReviewers: [removedReviewerId],
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      // The writing duty moves back to the admin, so every reviewer changes
      // duty, even the ones that were already assigned.
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: previousReviewerIds,
    },
  ])(
    "should emit PurposeRiskAnalysisWorkflowCreated with the reviewers that changed duty ($description)",
    async ({
      previousReviewMode,
      previousReviewers,
      expectedNewReviewers,
      expectedOldReviewers,
    }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers,
      });

      const { data: updatedPurpose } =
        await purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          {
            reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
            reviewerIds: requestedReviewerIds,
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        );

      expect(updatedPurpose.reviewMode).toEqual(
        riskAnalysisReviewMode.adminWritesReviewerSigns
      );
      expect(updatedPurpose.reviewerWorkflow).toEqual({
        reviewers: requestedReviewerIds.map((id) => ({
          id,
          sentToReviewerAt: undefined,
        })),
        signingState: RiskAnalysisSigningState.Values.Draft,
        sentToReviewerAt: undefined,
      } satisfies ReviewerWorkflow);

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

      expect(writtenPayload).toEqual({
        purpose: toPurposeV2(updatedPurpose),
        newReviewers: expectedNewReviewers,
        oldReviewers: expectedOldReviewers,
      });

      vi.useRealTimers();
    }
  );

  it.each([
    {
      description: "never assigned -> ReviewerWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: [],
    },
    {
      description: "AdminWritesAdminSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: [],
    },
    {
      description: "AdminWritesReviewerSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      // The reviewers become the writers, so all of them gain a new duty.
      expectedNewReviewers: requestedReviewerIds,
      expectedOldReviewers: [removedReviewerId],
    },
    {
      description: "ReviewerWritesReviewerSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      expectedNewReviewers: [addedReviewerId],
      expectedOldReviewers: [removedReviewerId],
    },
  ])(
    "should emit PurposeRiskAnalysisAssigned with the reviewers that changed duty ($description)",
    async ({
      previousReviewMode,
      previousReviewers,
      expectedNewReviewers,
      expectedOldReviewers,
    }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers,
      });

      const { data: updatedPurpose } =
        await purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          {
            reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
            reviewerIds: requestedReviewerIds,
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        );

      expect(updatedPurpose.reviewMode).toEqual(
        riskAnalysisReviewMode.reviewerWritesReviewerSigns
      );
      expect(updatedPurpose.reviewerWorkflow).toEqual({
        reviewers: requestedReviewerIds.map((id) => ({
          id,
          sentToReviewerAt:
            previousReviewMode ===
              riskAnalysisReviewMode.reviewerWritesReviewerSigns &&
            previousReviewers.includes(id)
              ? previousSentToReviewerAt
              : new Date(),
        })),
        signingState: RiskAnalysisSigningState.Values.Assigned,
        sentToReviewerAt: undefined,
      } satisfies ReviewerWorkflow);

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

      expect(writtenPayload).toEqual({
        purpose: toPurposeV2(updatedPurpose),
        newReviewers: expectedNewReviewers,
        oldReviewers: expectedOldReviewers,
      });

      vi.useRealTimers();
    }
  );

  it.each([
    {
      description: "AdminWritesReviewerSigns -> AdminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
    },
  ])(
    "should emit PurposeRiskAnalysisSelfAssigned listing every previous reviewer ($description)",
    async ({ previousReviewMode }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers: previousReviewerIds,
      });

      const { data: updatedPurpose } =
        await purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          {
            reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
            reviewerIds: [],
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        );

      expect(updatedPurpose.reviewMode).toEqual(
        riskAnalysisReviewMode.adminWritesAdminSigns
      );
      expect(updatedPurpose.reviewerWorkflow).toBeUndefined();

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "PurposeRiskAnalysisSelfAssigned",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeRiskAnalysisSelfAssignedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload).toEqual({
        purpose: toPurposeV2(updatedPurpose),
        oldReviewers: previousReviewerIds,
      });

      vi.useRealTimers();
    }
  );

  it("should emit PurposeRiskAnalysisSelfAssigned when a never assigned purpose is set to AdminWritesAdminSigns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const mockPurpose = await addPurposeInReviewMode({
      previousReviewMode: undefined,
      previousReviewers: [],
    });

    const { data: updatedPurpose, metadata } =
      await purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
          reviewerIds: [],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

    expect(updatedPurpose.reviewMode).toEqual(
      riskAnalysisReviewMode.adminWritesAdminSigns
    );
    expect(updatedPurpose.reviewerWorkflow).toBeUndefined();
    expect(metadata.version).toBe(1);

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "PurposeRiskAnalysisSelfAssigned",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeRiskAnalysisSelfAssignedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(updatedPurpose),
      oldReviewers: [],
    });

    vi.useRealTimers();
  });

  it("should not write any event when AdminWritesAdminSigns is requested again", async () => {
    const mockPurpose = await addPurposeInReviewMode({
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
    });

    const result = await purposeService.assignRiskAnalysisReviewer(
      mockPurpose.id,
      {
        reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
        reviewerIds: [],
      },
      getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
    );

    expect(result.data).toEqual(mockPurpose);
    expect(result.metadata.version).toBe(0);

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "0",
      type: "PurposeAdded",
    });
  });

  it("should not check the reviewers in selfcare for AdminWritesAdminSigns", async () => {
    const mockEService = getMockEService();
    const mockTenant = { ...getMockTenant(), selfcareId: undefined };
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
    await addOneTenant(mockTenant);
    await addOnePurpose(mockPurpose);

    mockSelfcareV2ClientCall([mockSelfCareUser]);

    const { data: updatedPurpose } =
      await purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
          reviewerIds: [],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

    expect(updatedPurpose.reviewMode).toEqual(
      riskAnalysisReviewMode.adminWritesAdminSigns
    );
    expect(
      selfcareV2Client.getInstitutionUsersByProductUsingGET
    ).not.toHaveBeenCalled();
  });

  it.each([
    riskAnalysisReviewMode.adminWritesReviewerSigns,
    riskAnalysisReviewMode.reviewerWritesReviewerSigns,
  ])(
    "should throw missingReviewers if no reviewer is provided for %s",
    async (requestedReviewMode) => {
      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode: undefined,
        previousReviewers: [],
      });

      expect(
        purposeService.assignRiskAnalysisReviewer(
          mockPurpose.id,
          { reviewMode: requestedReviewMode, reviewerIds: [] },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        )
      ).rejects.toThrowError(missingReviewers(mockPurpose.id));
    }
  );

  it("should throw reviewersNotAllowedForReviewMode if reviewers are provided for adminWritesAdminSigns", async () => {
    const mockPurpose = await addPurposeInReviewMode({
      previousReviewMode: undefined,
      previousReviewers: [],
    });

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(reviewersNotAllowedForReviewMode(mockPurpose.id));
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

  it("should throw missingSelfcareId if the consumer tenant has no selfcareId", async () => {
    const mockEService = getMockEService();
    const mockTenant = { ...getMockTenant(), selfcareId: undefined };
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
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
    const mockEService = getMockEService();
    const mockTenant = getMockTenant();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOneEService(mockEService);
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

  it("should throw purposeFromTemplateCannotBeModified if the purpose is from a template", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      purposeTemplateId,
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
    ).rejects.toThrowError(
      purposeFromTemplateCannotBeModified(mockPurpose.id, purposeTemplateId)
    );
  });

  it("should throw reviewerWorkflowNotAllowedForDelegatedPurpose if the purpose has an active delegation", async () => {
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      delegationId: generateId<DelegationId>(),
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
    ).rejects.toThrowError(
      reviewerWorkflowNotAllowedForDelegatedPurpose(mockPurpose.id)
    );
  });

  it("should throw reviewerWorkflowNotAllowedForReceiveMode if the eservice is in receive mode", async () => {
    const mockEService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
    };
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      eserviceId: mockEService.id,
    };

    await addOnePurpose(mockPurpose);
    await addOneEService(mockEService);

    expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [generateId()],
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrowError(
      reviewerWorkflowNotAllowedForReceiveMode(mockPurpose.id)
    );
  });

  it("should throw purposeNotInDraftState if the purpose is not in draft state", async () => {
    const mockPurpose: Purpose = getMockPurpose([
      getMockPurposeVersion(purposeVersionState.active),
    ]);

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
    ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
  });

  it("should throw reviewerWorkflowConflict if the risk analysis has already been signed", async () => {
    const reviewerId = generateId<UserId>();
    const mockPurpose: Purpose = {
      ...getMockPurpose([getMockPurposeVersion()]),
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: [{ id: reviewerId, sentToReviewerAt: undefined }],
        signingState: RiskAnalysisSigningState.Values.Signed,
        signedBy: generateId<UserId>(),
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
});
