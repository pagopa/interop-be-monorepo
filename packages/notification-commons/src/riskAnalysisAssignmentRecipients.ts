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
  removedReviewerIds: string[];
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
  const empty: AssignmentRecipients = {
    signingReviewerIds: [],
    writingReviewerIds: [],
    removedReviewerIds: [],
  };

  return match(event)
    .with({ type: "PurposeRiskAnalysisSubmitted" }, () => ({
      ...empty,
      signingReviewerIds: reviewerIds,
    }))
    .with(
      { type: "PurposeRiskAnalysisSelfAssigned" },
      { type: "PurposeRiskAnalysisWorkflowCreated" },
      { type: "PurposeRiskAnalysisAssigned" },
      ({ type, data }) => {
        const removedReviewerIds = data.removedReviewers
          .filter(({ sentToReviewerAt }) => sentToReviewerAt !== undefined)
          .map(({ id }) => id);
        if (type === "PurposeRiskAnalysisSelfAssigned") {
          return { ...empty, removedReviewerIds };
        }
        const previousMode =
          data.previousReviewMode === undefined
            ? undefined
            : fromRiskAnalysisReviewModeV2(data.previousReviewMode);
        const state = purpose.reviewerWorkflow?.signingState;
        const mode = purpose.reviewMode;
        const confirmedReviewerIds = reviewerIds.filter(
          (id) => !data.addedReviewers.includes(id)
        );

        if (
          mode === riskAnalysisReviewMode.reviewerWritesReviewerSigns &&
          state === riskAnalysisSigningState.assigned
        ) {
          return {
            ...empty,
            writingReviewerIds:
              previousMode === mode ? data.addedReviewers : reviewerIds,
            removedReviewerIds,
          };
        }
        if (mode === riskAnalysisReviewMode.adminWritesReviewerSigns) {
          return {
            ...empty,
            signingReviewerIds:
              state === riskAnalysisSigningState.submitted
                ? data.addedReviewers
                : [],
            // A confirmed writer loses their writing duty even though their id
            // is absent from the structural diff. The new workflow resets its stamp.
            removedReviewerIds:
              previousMode ===
                riskAnalysisReviewMode.reviewerWritesReviewerSigns &&
              state === riskAnalysisSigningState.draft
                ? [...removedReviewerIds, ...confirmedReviewerIds]
                : removedReviewerIds,
          };
        }
        return { ...empty, removedReviewerIds };
      }
    )
    .exhaustive();
}
