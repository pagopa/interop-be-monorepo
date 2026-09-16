import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  Purpose,
  PurposeEventV2,
  RiskAnalysisReviewer,
  RiskAnalysisReviewMode,
  ReviewerWorkflow,
  UserId,
  WithMetadata,
  unsafeBrandId,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { reviewerWorkflowNotFound } from "../model/domain/errors.js";
import {
  toCreateEventPurposeRiskAnalysisAssigned,
  toCreateEventPurposeRiskAnalysisSelfAssigned,
  toCreateEventPurposeRiskAnalysisWorkflowCreated,
} from "../model/domain/toEvent.js";

export type RiskAnalysisReviewAssignment = {
  reviewMode: RiskAnalysisReviewMode;
  reviewerIds: string[];
};

const isReviewerWritingMode = (
  reviewMode: RiskAnalysisReviewMode | undefined
): boolean => reviewMode === riskAnalysisReviewMode.reviewerWritesReviewerSigns;

const hasSameReviewerIds = (
  previousReviewerIds: UserId[],
  requestedReviewerIds: UserId[]
): boolean =>
  previousReviewerIds.length === requestedReviewerIds.length &&
  previousReviewerIds.every((id) => requestedReviewerIds.includes(id));

/**
 * Reviewers already in the workflow keep their stamp; joining reviewers get
 * the supplied stamp when they acquire an action to perform.
 */
const evaluateReviewerStamps = (
  reviewerIds: UserId[],
  previousReviewers: RiskAnalysisReviewer[],
  sentAt: Date | undefined
): RiskAnalysisReviewer[] => {
  const previousReviewerById = new Map(
    previousReviewers.map((reviewer) => [reviewer.id, reviewer])
  );

  return reviewerIds.map((id) => {
    const previousReviewer = previousReviewerById.get(id);

    return {
      id,
      sentToReviewerAt:
        previousReviewer !== undefined
          ? previousReviewer.sentToReviewerAt
          : sentAt,
    };
  });
};

type RiskAnalysisAssignmentContext = {
  purpose: WithMetadata<Purpose>;
  previousRiskAnalysisReviewMode: RiskAnalysisReviewMode | undefined;
  previousReviewers: RiskAnalysisReviewer[];
  requestedReviewers: UserId[];
  addedReviewers: UserId[];
  removedReviewers: RiskAnalysisReviewer[];
  now: Date;
};

type RiskAnalysisAssignmentOutcome = {
  reviewerWorkflow: ReviewerWorkflow | undefined;
};

const transitionToAdminWritesAdminSigns =
  (): RiskAnalysisAssignmentOutcome => ({
    reviewerWorkflow: undefined,
  });

const transitionToAdminWritesReviewerSigns = ({
  purpose,
  previousRiskAnalysisReviewMode,
  previousReviewers,
  requestedReviewers,
  now,
}: RiskAnalysisAssignmentContext): RiskAnalysisAssignmentOutcome =>
  match(previousRiskAnalysisReviewMode)
    .with(riskAnalysisReviewMode.adminWritesReviewerSigns, () => {
      const previousWorkflow = purpose.data.reviewerWorkflow;
      if (previousWorkflow === undefined) {
        throw reviewerWorkflowNotFound(purpose.data.id);
      }

      const shouldSetAddedReviewerSentAt =
        previousWorkflow.signingState === riskAnalysisSigningState.submitted;

      return {
        reviewerWorkflow: {
          ...previousWorkflow,
          reviewers: evaluateReviewerStamps(
            requestedReviewers,
            previousReviewers,
            shouldSetAddedReviewerSentAt ? now : undefined
          ),
          sentToReviewerAt: undefined,
        },
      };
    })
    .otherwise(() => ({
      reviewerWorkflow: {
        reviewers: requestedReviewers.map((id) => ({
          id,
          sentToReviewerAt: undefined,
        })),
        signingState: riskAnalysisSigningState.draft,
        sentToReviewerAt: undefined,
      },
    }));

const transitionToReviewerWritesReviewerSigns = ({
  previousRiskAnalysisReviewMode,
  previousReviewers,
  requestedReviewers,
  now,
}: RiskAnalysisAssignmentContext): RiskAnalysisAssignmentOutcome =>
  match(previousRiskAnalysisReviewMode)
    .with(riskAnalysisReviewMode.reviewerWritesReviewerSigns, () => ({
      reviewerWorkflow: {
        reviewers: evaluateReviewerStamps(
          requestedReviewers,
          previousReviewers,
          now
        ),
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: undefined,
      },
    }))
    .otherwise(() => ({
      reviewerWorkflow: {
        reviewers: requestedReviewers.map((id) => ({
          id,
          sentToReviewerAt: now,
        })),
        signingState: riskAnalysisSigningState.assigned,
        sentToReviewerAt: undefined,
      },
    }));

/**
 * Applies the requested reviewer assignment to the purpose, one branch per
 * transition between the previous and the requested review mode, where
 * AdminWritesAdminSigns has no reviewer workflow and an undefined previous
 * mode is a purpose that was never assigned.
 *
 * Each branch declares the resulting reviewer workflow. The risk analysis
 * form and structural event diff are derived once after selecting the
 * transition.
 */
export function assignRiskAnalysisReviewerLogic(
  purpose: WithMetadata<Purpose>,
  review: RiskAnalysisReviewAssignment,
  correlationId: CorrelationId
): {
  event: CreateEvent<PurposeEventV2> | undefined;
  updatedPurpose: Purpose;
} {
  const previousRiskAnalysisReviewMode = purpose.data.riskAnalysisReviewMode;
  const previousReviewers = purpose.data.reviewerWorkflow?.reviewers ?? [];
  const previousReviewerIds = previousReviewers.map((reviewer) => reviewer.id);
  const requestedReviewers = (review?.reviewerIds ?? []).map((id) =>
    unsafeBrandId<UserId>(id)
  );

  const assignmentIsUnchanged =
    previousRiskAnalysisReviewMode === review.reviewMode &&
    hasSameReviewerIds(previousReviewerIds, requestedReviewers);

  if (assignmentIsUnchanged) {
    return { event: undefined, updatedPurpose: purpose.data };
  }

  const addedReviewers = requestedReviewers.filter(
    (id) => !previousReviewerIds.includes(id)
  );
  const removedReviewers = previousReviewers.filter(
    (reviewer) => !requestedReviewers.includes(reviewer.id)
  );

  const now = new Date();

  const transitionContext: RiskAnalysisAssignmentContext = {
    purpose,
    previousRiskAnalysisReviewMode,
    previousReviewers,
    requestedReviewers,
    addedReviewers,
    removedReviewers,
    now,
  };

  const transitionOutcome = match(review.reviewMode)
    .returnType<RiskAnalysisAssignmentOutcome>()
    .with(riskAnalysisReviewMode.adminWritesAdminSigns, () =>
      transitionToAdminWritesAdminSigns()
    )
    .with(riskAnalysisReviewMode.adminWritesReviewerSigns, () =>
      transitionToAdminWritesReviewerSigns(transitionContext)
    )
    .with(riskAnalysisReviewMode.reviewerWritesReviewerSigns, () =>
      transitionToReviewerWritesReviewerSigns(transitionContext)
    )
    .exhaustive();

  const reviewerWritingModeChanged =
    isReviewerWritingMode(previousRiskAnalysisReviewMode) !==
    isReviewerWritingMode(review.reviewMode);

  const updatedPurpose: Purpose = {
    ...purpose.data,
    riskAnalysisForm: reviewerWritingModeChanged
      ? undefined
      : purpose.data.riskAnalysisForm,
    riskAnalysisReviewMode: review.reviewMode,
    reviewerWorkflow: transitionOutcome.reviewerWorkflow,
    updatedAt: now,
  };

  const event = match(review.reviewMode)
    .with(riskAnalysisReviewMode.adminWritesAdminSigns, () =>
      toCreateEventPurposeRiskAnalysisSelfAssigned({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
        removedReviewers,
        previousRiskAnalysisReviewMode,
      })
    )
    .with(riskAnalysisReviewMode.adminWritesReviewerSigns, () =>
      toCreateEventPurposeRiskAnalysisWorkflowCreated({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
        addedReviewers,
        removedReviewers,
        previousRiskAnalysisReviewMode,
      })
    )
    .with(riskAnalysisReviewMode.reviewerWritesReviewerSigns, () =>
      toCreateEventPurposeRiskAnalysisAssigned({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        correlationId,
        addedReviewers,
        removedReviewers,
        previousRiskAnalysisReviewMode,
      })
    )
    .exhaustive();

  return { event, updatedPurpose };
}
