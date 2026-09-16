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
  fromReviewerWorkflowV2,
  ReviewerWorkflowV2,
  RiskAnalysisSigningStateV2,
  riskAnalysisSigningState,
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
  duplicatedReviewersInSeed,
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
    })
 * events can be told apart from the plain reviewer lists.
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
  previousReviewers: UserId[],
  signingState: RiskAnalysisSigningState = riskAnalysisSigningState.draft,
  alreadyNotifiedReviewerIds: UserId[] = []
): ReviewerWorkflow | undefined {
  return match(previousReviewMode)
    .with(riskAnalysisReviewMode.reviewerWritesReviewerSigns, () => ({
      reviewers: previousReviewers.map((id) => ({
        id,
        sentToReviewerAt: previousSentToReviewerAt,
      })),
      signingState: riskAnalysisSigningState.assigned,
      sentToReviewerAt: previousSentToReviewerAt,
    }))
    .with(riskAnalysisReviewMode.adminWritesReviewerSigns, () => ({
      reviewers: previousReviewers.map((id) => ({
        id,
        sentToReviewerAt: alreadyNotifiedReviewerIds.includes(id)
          ? previousSentToReviewerAt
          : undefined,
      })),
      signingState,
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
  signingState,
  alreadyNotifiedReviewerIds,
}: {
  previousReviewMode: RiskAnalysisReviewMode | undefined;
  previousReviewers: UserId[];
  riskAnalysisForm?: PurposeRiskAnalysisForm;
  signingState?: RiskAnalysisSigningState;
  alreadyNotifiedReviewerIds?: UserId[];
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
      previousReviewers,
      signingState,
      alreadyNotifiedReviewerIds
    ),
  };

  await addOneEService(mockEService);
  await addOneTenant(mockTenant);
  await addOnePurpose(mockPurpose);

  mockSelfcareV2ClientCall([mockSelfCareUser]);

  return mockPurpose;
}

type AssignmentEventType =
  | "PurposeRiskAnalysisSelfAssigned"
  | "PurposeRiskAnalysisWorkflowCreated"
  | "PurposeRiskAnalysisAssigned";

async function expectAssignmentEvent({
  purposeId,
  purpose,
  type,
  addedReviewers = [],
  removedReviewerIds = [],
  previousReviewMode,
}: {
  purposeId: PurposeId;
  purpose: Purpose;
  type: AssignmentEventType;
  addedReviewers?: UserId[];
  removedReviewerIds?: UserId[];
  previousReviewMode?: RiskAnalysisReviewMode;
}): Promise<void> {
  const writtenEvent = await readLastPurposeEvent(purposeId);

  expect(writtenEvent).toMatchObject({
    stream_id: purposeId,
    version: "1",
    type,
    event_version: 2,
  });

  const expectedPreviousReviewMode =
    previousReviewMode === undefined
      ? undefined
      : toPurposeV2({ ...purpose, reviewMode: previousReviewMode }).reviewMode;
  const expectedPurpose = {
    id: purpose.id,
    ...(purpose.reviewMode === undefined
      ? {}
      : { reviewMode: toPurposeV2(purpose).reviewMode }),
  };
  const expectCommonPayload = (payload: {
    purpose?: { id: string; reviewMode?: unknown };
    removedReviewers: { id: string; sentToReviewerAt?: bigint }[];
    previousReviewMode?: unknown;
  }): void => {
    expect(payload.purpose).toMatchObject(expectedPurpose);
    expect(payload.removedReviewers.map(({ id }) => id)).toEqual(
      removedReviewerIds
    );
    expect(payload.previousReviewMode).toBe(expectedPreviousReviewMode);
  };

  match(type)
    .with("PurposeRiskAnalysisSelfAssigned", () => {
      const payload = decodeProtobufPayload({
        messageType: PurposeRiskAnalysisSelfAssignedV2,
        payload: writtenEvent.data,
      });
      expectCommonPayload(payload);
    })
    .with("PurposeRiskAnalysisWorkflowCreated", () => {
      const payload = decodeProtobufPayload({
        messageType: PurposeRiskAnalysisWorkflowCreatedV2,
        payload: writtenEvent.data,
      });
      expectCommonPayload(payload);
      expect(payload.addedReviewers).toEqual(addedReviewers);
    })
    .with("PurposeRiskAnalysisAssigned", () => {
      const payload = decodeProtobufPayload({
        messageType: PurposeRiskAnalysisAssignedV2,
        payload: writtenEvent.data,
      });
      expectCommonPayload(payload);
      expect(payload.addedReviewers).toEqual(addedReviewers);
    })
    .exhaustive();
}

describe("assignRiskAnalysisReviewer", () => {
  it("should read reviewers from legacy protobuf workflow fields", () => {
    const legacySentToReviewerAt = new Date("2020-01-01T00:00:00.000Z");
    const reviewerIds = [generateId<UserId>(), generateId<UserId>()];
    const legacyWorkflow = ReviewerWorkflowV2.create({
      reviewerIds,
      reviewers: [],
      signingState: RiskAnalysisSigningStateV2.RISK_ANALYSIS_ASSIGNED,
      sentToReviewerAt: BigInt(legacySentToReviewerAt.getTime()),
    });

    expect(fromReviewerWorkflowV2(legacyWorkflow)).toEqual({
      reviewers: reviewerIds.map((id) => ({
        id,
        sentToReviewerAt: legacySentToReviewerAt,
      })),
      signingState: RiskAnalysisSigningState.Values.Assigned,
      sentToReviewerAt: legacySentToReviewerAt,
    });
  });

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
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      addedReviewers: reviewerIds,
      removedReviewers: [],
    });
    expect(writtenPayload.addedReviewers).toEqual(reviewerIds);
    expect(writtenPayload.removedReviewers).toEqual([]);

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
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload.purpose).toMatchObject({
      id: expectedPurpose.id,
      reviewMode: toPurposeV2(expectedPurpose).reviewMode,
    });
    expect(writtenPayload.addedReviewers).toEqual(reviewerIds);
    expect(writtenPayload.removedReviewers).toEqual([]);

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
    };

    const expectedPurpose: Purpose = {
      ...mockPurpose,
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      reviewerWorkflow: expectedReviewerWorkflow,
      updatedAt: new Date(),
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      addedReviewers: reviewerIds,
      removedReviewers: [],
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
      newReviewersToNotify: reviewerIds,
      oldReviewersToNotify: [],
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

  it.each([
    {
      signingState: RiskAnalysisSigningState.Values.Submitted,
      shouldStampAddedReviewer: true,
    },
    {
      signingState: RiskAnalysisSigningState.Values.Rejected,
      shouldStampAddedReviewer: false,
    },
  ])(
    "should preserve the mode 2 workflow in $signingState when reviewers change",
    async ({ signingState, shouldStampAddedReviewer }) => {
      vi.useFakeTimers();
      const now = new Date();
      vi.setSystemTime(now);

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
        previousReviewers: previousReviewerIds,
        signingState,
        notifiedReviewerIds: [keptReviewerId, removedReviewerId],
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

      expect(updatedPurpose.reviewerWorkflow).toEqual({
        reviewers: [
          {
            id: keptReviewerId,
            sentToReviewerAt: previousSentToReviewerAt,
          },
          {
            id: addedReviewerId,
            sentToReviewerAt: shouldStampAddedReviewer ? now : undefined,
          },
        ],
        signingState,
        sentToReviewerAt: undefined,
      } satisfies ReviewerWorkflow);

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);
      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeRiskAnalysisWorkflowCreatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload).toEqual({
        purpose: toPurposeV2(updatedPurpose),
        newReviewersToNotify: shouldStampAddedReviewer ? [addedReviewerId] : [],
        oldReviewersToNotify: [removedReviewerId],
      });

      vi.useRealTimers();
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
        getMockContext({ authData: getMockAuthData() })
      )
    ).rejects.toThrow(purposeNotFound(randomId));
  });

  it.each([
    {
      description: "never assigned -> AdminWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
    },
    {
      description: "AdminWritesAdminSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
    },
    {
      description: "AdminWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
    },
    {
      description:
        "AdminWritesReviewerSigns -> AdminWritesReviewerSigns, removed reviewer never notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      notifiedReviewerIds: [keptReviewerId],
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: previousReviewerIds,
    },
  ])(
    "should emit PurposeRiskAnalysisWorkflowCreated with the reviewers to notify ($description)",
    async ({
      previousReviewMode,
      previousReviewers,
      expectedNewReviewersToNotify,
      expectedOldReviewersToNotify,
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
        newReviewersToNotify: expectedNewReviewersToNotify,
        oldReviewersToNotify: expectedOldReviewersToNotify,
      });

      vi.useRealTimers();
    }
  );

  it.each([
    {
      description: "never assigned -> ReviewerWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
    },
    {
      description: "AdminWritesAdminSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
    },
    {
      description:
        "AdminWritesReviewerSigns -> ReviewerWritesReviewerSigns, removed reviewer never notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      notifiedReviewerIds: [],
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
    },
    {
      description:
        "AdminWritesReviewerSigns -> ReviewerWritesReviewerSigns, removed reviewer already notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      notifiedReviewerIds: [removedReviewerId],
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [removedReviewerId],
    },
    {
      description: "ReviewerWritesReviewerSigns -> ReviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      expectedNewReviewersToNotify: [addedReviewerId],
      expectedOldReviewersToNotify: [removedReviewerId],
    },
  ])(
    "should emit PurposeRiskAnalysisAssigned with the reviewers to notify ($description)",
    async ({
      previousReviewMode,
      previousReviewers,
      notifiedReviewerIds,
      expectedNewReviewersToNotify,
      expectedOldReviewersToNotify,
    }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers,
        notifiedReviewerIds,
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
        newReviewersToNotify: expectedNewReviewersToNotify,
        oldReviewersToNotify: expectedOldReviewersToNotify,
      });

      vi.useRealTimers();
    }
  );

  it.each([
    {
      description:
        "AdminWritesReviewerSigns -> AdminWritesAdminSigns, never notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      notifiedReviewerIds: [],
      expectedOldReviewersToNotify: [],
    },
    {
      description:
        "AdminWritesReviewerSigns -> AdminWritesAdminSigns, already notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      notifiedReviewerIds: previousReviewerIds,
      expectedOldReviewersToNotify: previousReviewerIds,
    },
    {
      description:
        "AdminWritesReviewerSigns -> AdminWritesAdminSigns, partially notified",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      notifiedReviewerIds: [keptReviewerId],
      expectedOldReviewersToNotify: [keptReviewerId],
    },
    {
      description: "ReviewerWritesReviewerSigns -> AdminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      notifiedReviewerIds: previousReviewerIds,
      expectedOldReviewersToNotify: previousReviewerIds,
    },
  ])(
    "should emit PurposeRiskAnalysisSelfAssigned with reviewers to notify ($description)",
    async ({
      previousReviewMode,
      notifiedReviewerIds,
      expectedOldReviewersToNotify,
    }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers: previousReviewerIds,
        notifiedReviewerIds,
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
        oldReviewersToNotify: expectedOldReviewersToNotify,
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
        getMockContext({ authData: getMockAuthData(otherOrganizationId) })
      )
    ).rejects.toThrow(tenantIsNotTheConsumer(otherOrganizationId));
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
    ).rejects.toThrow(reviewerWorkflowConflict(mockPurpose.id));
  });

  it.each([
    {
      description: "A: adminWritesAdminSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.draft,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: requestedReviewerIds,
      expectedRemovedReviewerIds: [],
      shouldResetForm: false,
    },
    {
      description: "B: adminWritesAdminSigns -> reviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.assigned,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.assigned,
      expectedEventType: "PurposeRiskAnalysisAssigned",
      expectedAddedReviewers: requestedReviewerIds,
      expectedRemovedReviewerIds: [],
      shouldResetForm: true,
    },
    {
      description: "C-draft: adminWritesReviewerSigns -> adminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: undefined,
      expectedEventType: "PurposeRiskAnalysisSelfAssigned",
      expectedAddedReviewers: [],
      expectedRemovedReviewerIds: previousReviewerIds,
      shouldResetForm: false,
    },
    {
      description:
        "C-submitted: adminWritesReviewerSigns -> adminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      signingState: riskAnalysisSigningState.submitted,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: undefined,
      expectedEventType: "PurposeRiskAnalysisSelfAssigned",
      expectedAddedReviewers: [],
      expectedRemovedReviewerIds: previousReviewerIds,
      shouldResetForm: false,
    },
    {
      description:
        "C-rejected-partial: adminWritesReviewerSigns -> adminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      signingState: riskAnalysisSigningState.rejected,
      alreadyNotifiedReviewerIds: [keptReviewerId],
      expectedSigningState: undefined,
      expectedEventType: "PurposeRiskAnalysisSelfAssigned",
      expectedAddedReviewers: [],
      expectedRemovedReviewerIds: previousReviewerIds,
      shouldResetForm: false,
    },
    {
      description: "D: reviewerWritesReviewerSigns -> adminWritesAdminSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      signingState: riskAnalysisSigningState.assigned,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: undefined,
      expectedEventType: "PurposeRiskAnalysisSelfAssigned",
      expectedAddedReviewers: [],
      expectedRemovedReviewerIds: previousReviewerIds,
      shouldResetForm: true,
    },
    {
      description:
        "E-draft: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.draft,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "E-draft-partial: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [keptReviewerId],
      expectedSigningState: riskAnalysisSigningState.draft,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "E-rejected: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.rejected,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: riskAnalysisSigningState.rejected,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "E-rejected-partial: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.rejected,
      alreadyNotifiedReviewerIds: [removedReviewerId],
      expectedSigningState: riskAnalysisSigningState.rejected,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "E-rejected-unnotified: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.rejected,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.rejected,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "E-submitted: adminWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.submitted,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: riskAnalysisSigningState.submitted,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "F: reviewerWritesReviewerSigns -> reviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.assigned,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: riskAnalysisSigningState.assigned,
      expectedEventType: "PurposeRiskAnalysisAssigned",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: false,
    },
    {
      description:
        "G-draft: adminWritesReviewerSigns -> reviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.assigned,
      expectedEventType: "PurposeRiskAnalysisAssigned",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: true,
    },
    {
      description:
        "G-rejected: adminWritesReviewerSigns -> reviewerWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.rejected,
      alreadyNotifiedReviewerIds: [removedReviewerId],
      expectedSigningState: riskAnalysisSigningState.assigned,
      expectedEventType: "PurposeRiskAnalysisAssigned",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: true,
    },
    {
      description: "H: reviewerWritesReviewerSigns -> adminWritesReviewerSigns",
      previousReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: previousReviewerIds,
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.assigned,
      alreadyNotifiedReviewerIds: previousReviewerIds,
      expectedSigningState: riskAnalysisSigningState.draft,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: [addedReviewerId],
      expectedRemovedReviewerIds: [removedReviewerId],
      shouldResetForm: true,
    },
    {
      description: "I: undefined -> adminWritesAdminSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      requestedReviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: undefined,
      expectedEventType: "PurposeRiskAnalysisSelfAssigned",
      expectedAddedReviewers: [],
      expectedRemovedReviewerIds: [],
      shouldResetForm: false,
    },
    {
      description: "J: undefined -> adminWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      requestedReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      signingState: riskAnalysisSigningState.draft,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.draft,
      expectedEventType: "PurposeRiskAnalysisWorkflowCreated",
      expectedAddedReviewers: requestedReviewerIds,
      expectedRemovedReviewerIds: [],
      shouldResetForm: false,
    },
    {
      description: "K: undefined -> reviewerWritesReviewerSigns",
      previousReviewMode: undefined,
      previousReviewers: [],
      requestedReviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      signingState: riskAnalysisSigningState.assigned,
      alreadyNotifiedReviewerIds: [],
      expectedSigningState: riskAnalysisSigningState.assigned,
      expectedEventType: "PurposeRiskAnalysisAssigned",
      expectedAddedReviewers: requestedReviewerIds,
      expectedRemovedReviewerIds: [],
      shouldResetForm: true,
    },
  ])(
    "should apply the complete assignment transition ($description)",
    async ({
      description,
      previousReviewMode,
      previousReviewers,
      requestedReviewMode,
      signingState,
      alreadyNotifiedReviewerIds,
      expectedSigningState,
      expectedEventType,
      expectedAddedReviewers,
      expectedRemovedReviewerIds,
      shouldResetForm,
    }) => {
      vi.useFakeTimers();
      const now = new Date();
      vi.setSystemTime(now);

      const riskAnalysisForm = getMockValidRiskAnalysisForm(tenantKind.PA);
      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode,
        previousReviewers,
        riskAnalysisForm,
        signingState,
        alreadyNotifiedReviewerIds: alreadyNotifiedReviewerIds,
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

      expect(updatedPurpose.reviewMode).toBe(requestedReviewMode);
      expect(updatedPurpose.riskAnalysisForm).toEqual(
        shouldResetForm ? undefined : riskAnalysisForm
      );

      expect(updatedPurpose.reviewerWorkflow?.signingState, description).toBe(
        expectedSigningState
      );
      expect(
        updatedPurpose.reviewerWorkflow?.reviewers.map(
          (reviewer) => reviewer.id
        ) ?? []
      ).toEqual(reviewersFor(requestedReviewMode));

      const isMode2ToMode2Transition =
        previousReviewMode ===
          riskAnalysisReviewMode.adminWritesReviewerSigns &&
        requestedReviewMode === riskAnalysisReviewMode.adminWritesReviewerSigns;
      const isSubmittedOrRejected =
        signingState === riskAnalysisSigningState.submitted ||
        signingState === riskAnalysisSigningState.rejected;

      // When remaining in mode 2, preserve the notification timestamp for reviewers already notified.
      if (isMode2ToMode2Transition && isSubmittedOrRejected) {
        expect(updatedPurpose.reviewerWorkflow).toEqual({
          reviewers: [
            {
              id: keptReviewerId,
              sentToReviewerAt: alreadyNotifiedReviewerIds.includes(
                keptReviewerId
              )
                ? previousSentToReviewerAt
                : undefined,
            },
            {
              id: addedReviewerId,
              sentToReviewerAt:
                signingState === riskAnalysisSigningState.submitted
                  ? now
                  : undefined,
            },
          ],
          signingState,
          sentToReviewerAt: undefined,
        } satisfies ReviewerWorkflow);
      }

      match({ previousReviewMode, requestedReviewMode })
        .with(
          {
            previousReviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
            requestedReviewMode:
              riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          },
          () => {
            expect(updatedPurpose.reviewerWorkflow?.reviewers).toEqual([
              { id: keptReviewerId, sentToReviewerAt: now },
              { id: addedReviewerId, sentToReviewerAt: now },
            ]);
          }
        )
        .with(
          {
            previousReviewMode:
              riskAnalysisReviewMode.reviewerWritesReviewerSigns,
            requestedReviewMode:
              riskAnalysisReviewMode.adminWritesReviewerSigns,
          },
          () => {
            expect(updatedPurpose.reviewerWorkflow?.reviewers).toEqual([
              { id: keptReviewerId, sentToReviewerAt: undefined },
              { id: addedReviewerId, sentToReviewerAt: undefined },
            ]);
          }
        )
        .otherwise(() => undefined);

      await expectAssignmentEvent({
        purposeId: mockPurpose.id,
        purpose: updatedPurpose,
        type: expectedEventType as AssignmentEventType,
        addedReviewers: expectedAddedReviewers,
        removedReviewerIds: expectedRemovedReviewerIds,
        previousReviewMode,
      });

      vi.useRealTimers();
    }
  );

  it.each([
    {
      reviewMode: riskAnalysisReviewMode.adminWritesAdminSigns,
      previousReviewers: [],
      requestedReviewers: [],
    },
    {
      reviewMode: riskAnalysisReviewMode.adminWritesReviewerSigns,
      previousReviewers: requestedReviewerIds,
      requestedReviewers: [...requestedReviewerIds].reverse(),
    },
    {
      reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
      previousReviewers: requestedReviewerIds,
      requestedReviewers: [...requestedReviewerIds].reverse(),
    },
  ])(
    "should not write any event when the same assignment is requested again ($reviewMode)",
    async ({ reviewMode, previousReviewers, requestedReviewers }) => {
      const mockPurpose = await addPurposeInReviewMode({
        previousReviewMode: reviewMode,
        previousReviewers,
      });

      const result = await purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode,
          reviewerIds: requestedReviewers,
        },
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      );

      expect(result.data.reviewMode).toBe(reviewMode);
      expect(
        result.data.reviewerWorkflow?.reviewers.map(
          (reviewer) => reviewer.id
        ) ?? []
      ).toEqual(previousReviewers);
      expect(result.data.updatedAt).toBe(mockPurpose.updatedAt);
      expect(result.metadata.version).toBe(0);

      const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "0",
        type: "PurposeAdded",
      });
    }
  );

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
          {
            reviewMode: requestedReviewMode,
            reviewerIds: [],
          },
          getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
        )
      ).rejects.toThrow(missingReviewers(mockPurpose.id));
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
        getMockContext({ authData: getMockAuthData(otherOrganizationId) })
      )
    ).rejects.toThrow(reviewersNotAllowedForReviewMode(mockPurpose.id));
  });

  it("should throw duplicatedReviewersInSeed for duplicate reviewers", async () => {
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

    const reviewerId = generateId<UserId>();

    const ctx = getMockContext({
      authData: getMockAuthData(mockPurpose.consumerId),
    });

    await expect(
      purposeService.assignRiskAnalysisReviewer(
        mockPurpose.id,
        {
          reviewMode: riskAnalysisReviewMode.reviewerWritesReviewerSigns,
          reviewerIds: [reviewerId, reviewerId],
        },
        ctx
      )
    ).rejects.toEqual(duplicatedReviewersInSeed());

    vi.useRealTimers();
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
    ).rejects.toThrow(missingSelfcareId(mockTenant.id));
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
    ).rejects.toThrow(userWithoutReviewerPrivileges(mockTenant.id, reviewerId));
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
    ).rejects.toThrow(
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
    ).rejects.toThrow(
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
    ).rejects.toThrow(reviewerWorkflowNotAllowedForReceiveMode(mockPurpose.id));
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
    ).rejects.toThrow(purposeNotInDraftState(mockPurpose.id));
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
