import {
  fromPurposeV2,
  fromRiskAnalysisReviewModeV2,
  missingKafkaMessageDataError,
  PurposeEventV2,
  riskAnalysisReviewMode,
  riskAnalysisSigningState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

type AssignmentEvent = Extract<
  PurposeEventV2,
  {
    type:
      | "PurposeRiskAnalysisAssigned"
      | "PurposeRiskAnalysisWorkflowCreated"
      | "PurposeRiskAnalysisSelfAssigned"
      | "PurposeRiskAnalysisSubmitted";
  }
>;

/**
 * Each array maps to a specific notification handler. Signing and writing
 * recipients are mutually exclusive for a single event, while assignment
 * removals are independent and may accompany either kind of assignment.
 */
type AssignmentRecipients = {
  signingReviewerIds: string[];
  writingReviewerIds: string[];
  assignmentRemovedReviewerIds: string[];
};

/**
 * Derives notification recipients from the assignment event rather than from
 * the current workflow alone. The current workflow says who is assigned now,
 * while the event also carries the structural diff and the previous review
 * mode needed to understand who gained or lost an assignment.
 */
export function getRiskAnalysisAssignmentRecipients(
  event: AssignmentEvent
): AssignmentRecipients {
  if (!event.data.purpose) {
    throw missingKafkaMessageDataError("purpose", event.type);
  }
  const purpose = fromPurposeV2(event.data.purpose);
  const reviewerIds =
    purpose.reviewerWorkflow?.reviewers.map(({ id }) => id) ?? [];

  // A removed reviewer must be notified only if the previous assignment had
  // already been communicated. Without sentToReviewerAt, notifying the removal
  // would reveal an assignment the reviewer was never aware of.
  const baseRecipients: AssignmentRecipients = {
    signingReviewerIds: [],
    writingReviewerIds: [],
    assignmentRemovedReviewerIds:
      event.type === "PurposeRiskAnalysisSubmitted"
        ? []
        : event.data.removedReviewers
            .filter(({ sentToReviewerAt }) => sentToReviewerAt !== undefined)
            .map(({ id }) => id),
  };

  const recipients = match(event)
    // Submitting (or resubmitting) the analysis makes every current reviewer
    // responsible for signing it, regardless of earlier notification dates.
    .with({ type: "PurposeRiskAnalysisSubmitted" }, () => ({
      ...baseRecipients,
      signingReviewerIds: reviewerIds,
    }))
    // In the self-assignment mode the administrator both writes and signs the
    // analysis, so there is no reviewer assignment to notify.
    .with({ type: "PurposeRiskAnalysisSelfAssigned" }, () => baseRecipients)
    .with({ type: "PurposeRiskAnalysisAssigned" }, ({ data }) => {
      // PurposeRiskAnalysisAssigned produces a writing-and-signing notification
      // only when reviewers own the writing step and the workflow is actually
      // assigned. Assignment removals are still returned separately.
      if (
        purpose.riskAnalysisReviewMode !==
          riskAnalysisReviewMode.reviewerWritesReviewerSigns ||
        purpose.reviewerWorkflow?.signingState !==
          riskAnalysisSigningState.assigned
      ) {
        return baseRecipients;
      }
      const previousMode =
        data.previousRiskAnalysisReviewMode === undefined
          ? undefined
          : fromRiskAnalysisReviewModeV2(data.previousRiskAnalysisReviewMode);
      return {
        ...baseRecipients,
        // For an unchanged mode the event diff identifies the new writers. On
        // a mode change, every reviewer acquires the writing responsibility,
        // including reviewers already present in the workflow.
        writingReviewerIds:
          previousMode === purpose.riskAnalysisReviewMode
            ? data.addedReviewers
            : reviewerIds,
      };
    })
    .with({ type: "PurposeRiskAnalysisWorkflowCreated" }, ({ data }) => {
      // Workflow creation represents a signing assignment only when the
      // administrator writes the analysis and reviewers sign it.
      if (
        purpose.riskAnalysisReviewMode !==
        riskAnalysisReviewMode.adminWritesReviewerSigns
      ) {
        return baseRecipients;
      }
      const previousMode =
        data.previousRiskAnalysisReviewMode === undefined
          ? undefined
          : fromRiskAnalysisReviewModeV2(data.previousRiskAnalysisReviewMode);
      const state = purpose.reviewerWorkflow?.signingState;
      const confirmedReviewerIds = reviewerIds.filter(
        (id) => !data.addedReviewers.includes(id)
      );

      return {
        ...baseRecipients,
        // Reviewers receive the signing assignment only after submission. In
        // draft state the workflow exists, but there is nothing to sign yet.
        signingReviewerIds:
          state === riskAnalysisSigningState.submitted
            ? data.addedReviewers
            : [],
        // Moving from reviewer-writes to admin-writes removes the writing
        // responsibility from all previously confirmed writers. They remain
        // in the workflow as future signers, so removedReviewers alone cannot
        // describe this semantic assignment removal.
        assignmentRemovedReviewerIds:
          previousMode === riskAnalysisReviewMode.reviewerWritesReviewerSigns &&
          state === riskAnalysisSigningState.draft
            ? [
                ...baseRecipients.assignmentRemovedReviewerIds,
                ...confirmedReviewerIds,
              ]
            : baseRecipients.assignmentRemovedReviewerIds,
      };
    })
    .exhaustive();

  return recipients;
}
