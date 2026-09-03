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

type AssignmentRecipients = {
  signingReviewerIds: string[];
  writingReviewerIds: string[];
  assignmentRemovedReviewerIds: string[];
};

export function getRiskAnalysisAssignmentRecipients(
  event: AssignmentEvent
): AssignmentRecipients {
  if (!event.data.purpose) {
    throw missingKafkaMessageDataError("purpose", event.type);
  }
  const purpose = fromPurposeV2(event.data.purpose);
  const reviewerIds =
    purpose.reviewerWorkflow?.reviewers.map(({ id }) => id) ?? [];
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

  return match(event)
    .with({ type: "PurposeRiskAnalysisSubmitted" }, () => ({
      ...baseRecipients,
      signingReviewerIds: reviewerIds,
    }))
    .with({ type: "PurposeRiskAnalysisSelfAssigned" }, () => baseRecipients)
    .with({ type: "PurposeRiskAnalysisAssigned" }, ({ data }) => {
      if (
        purpose.reviewMode !==
          riskAnalysisReviewMode.reviewerWritesReviewerSigns ||
        purpose.reviewerWorkflow?.signingState !==
          riskAnalysisSigningState.assigned
      ) {
        return baseRecipients;
      }
      const previousMode =
        data.previousReviewMode === undefined
          ? undefined
          : fromRiskAnalysisReviewModeV2(data.previousReviewMode);
      return {
        ...baseRecipients,
        writingReviewerIds:
          previousMode === purpose.reviewMode
            ? data.addedReviewers
            : reviewerIds,
      };
    })
    .with({ type: "PurposeRiskAnalysisWorkflowCreated" }, ({ data }) => {
      if (
        purpose.reviewMode !== riskAnalysisReviewMode.adminWritesReviewerSigns
      ) {
        return baseRecipients;
      }
      const previousMode =
        data.previousReviewMode === undefined
          ? undefined
          : fromRiskAnalysisReviewModeV2(data.previousReviewMode);
      const state = purpose.reviewerWorkflow?.signingState;
      const confirmedReviewerIds = reviewerIds.filter(
        (id) => !data.addedReviewers.includes(id)
      );

      return {
        ...baseRecipients,
        signingReviewerIds:
          state === riskAnalysisSigningState.submitted
            ? data.addedReviewers
            : [],
        // Confirmed writers lose their writing assignment on a mode change,
        // even though they remain in the workflow and their timestamps are reset.
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
}
