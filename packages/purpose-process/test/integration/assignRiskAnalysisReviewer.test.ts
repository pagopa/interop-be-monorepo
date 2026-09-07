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
 * drops another and adds a new one, so that the notification lists carried by
 * the events can be told apart from the plain reviewer lists.
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
  newReviewersToNotify = [],
  oldReviewersToNotify = [],
}: {
  purposeId: PurposeId;
  purpose: Purpose;
  type: AssignmentEventType;
  newReviewersToNotify?: UserId[];
  oldReviewersToNotify?: UserId[];
}): Promise<void> {
  const writtenEvent = await readLastPurposeEvent(purposeId);

  expect(writtenEvent).toMatchObject({
    stream_id: purposeId,
    version: "1",
    type,
    event_version: 2,
  });

  const writtenPayload = match(type)
    .with("PurposeRiskAnalysisSelfAssigned", () =>
      decodeProtobufPayload({
        messageType: PurposeRiskAnalysisSelfAssignedV2,
        payload: writtenEvent.data,
      })
    )
    .with("PurposeRiskAnalysisWorkflowCreated", () =>
      decodeProtobufPayload({
        messageType: PurposeRiskAnalysisWorkflowCreatedV2,
        payload: writtenEvent.data,
      })
    )
    .with("PurposeRiskAnalysisAssigned", () =>
      decodeProtobufPayload({
        messageType: PurposeRiskAnalysisAssignedV2,
        payload: writtenEvent.data,
      })
    )
    .exhaustive();

  const expectedPayload = {
    purpose: toPurposeV2(purpose),
    oldReviewersToNotify,
    ...(type === "PurposeRiskAnalysisSelfAssigned"
      ? {}
      : { newReviewersToNotify }),
  };

  expect(writtenPayload).toEqual(expectedPayload);
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

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
      newReviewersToNotify: [],
      oldReviewersToNotify: [],
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
    ).rejects.toThrow(purposeNotFound(randomId));
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: previousReviewerIds,
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [keptReviewerId],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: previousReviewerIds,
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [removedReviewerId],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [removedReviewerId],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [addedReviewerId],
      expectedOldReviewersToNotify: [removedReviewerId],
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
      expectedNewReviewersToNotify: [addedReviewerId],
      expectedOldReviewersToNotify: [removedReviewerId],
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
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [removedReviewerId],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: previousReviewerIds,
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: [],
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify: requestedReviewerIds,
      expectedOldReviewersToNotify: [],
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
      expectedNewReviewersToNotify,
      expectedOldReviewersToNotify,
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

      // In mode 2, reviewer timestamps determine who has already been notified.
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

      await expectAssignmentEvent({
        purposeId: mockPurpose.id,
        purpose: updatedPurpose,
        type: expectedEventType as AssignmentEventType,
        newReviewersToNotify: expectedNewReviewersToNotify,
        oldReviewersToNotify: expectedOldReviewersToNotify,
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
          { reviewMode: requestedReviewMode, reviewerIds: [] },
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
        getMockContext({ authData: getMockAuthData(mockPurpose.consumerId) })
      )
    ).rejects.toThrow(reviewersNotAllowedForReviewMode(mockPurpose.id));
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
    ).rejects.toThrow(tenantIsNotTheConsumer(otherOrganizationId));
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
    ).rejects.toThrow(reviewerWorkflowConflict(mockPurpose.id));
  });
});
