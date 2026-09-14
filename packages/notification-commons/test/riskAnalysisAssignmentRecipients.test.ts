import {
  PurposeEventV2,
  PurposeV2,
  RiskAnalysisReviewerV2,
  RiskAnalysisReviewModeV2 as Mode,
  RiskAnalysisSigningStateV2 as State,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { getRiskAnalysisAssignmentRecipients } from "../src/riskAnalysisAssignmentRecipients.js";

const admin = Mode.ADMIN_WRITES_ADMIN_SIGNS;
const signing = Mode.ADMIN_WRITES_REVIEWER_SIGNS;
const writing = Mode.REVIEWER_WRITES_REVIEWER_SIGNS;
const draft = State.RISK_ANALYSIS_DRAFT;
const submitted = State.RISK_ANALYSIS_SUBMITTED;
const rejected = State.RISK_ANALYSIS_REJECTED;
const assigned = State.RISK_ANALYSIS_ASSIGNED;

function assignmentEvent({
  mode,
  previousMode,
  state,
  added = ["y"],
  reviewers = ["x", "y"],
  removed = [{ id: "z", sentToReviewerAt: 1n }, { id: "unaware" }],
}: {
  mode: Mode;
  previousMode?: Mode;
  state: State;
  added?: string[];
  reviewers?: string[];
  removed?: RiskAnalysisReviewerV2[];
}): Extract<
  PurposeEventV2,
  {
    type:
      | "PurposeRiskAnalysisAssigned"
      | "PurposeRiskAnalysisWorkflowCreated"
      | "PurposeRiskAnalysisSelfAssigned";
  }
> {
  const purpose = PurposeV2.create({
    reviewMode: mode,
    reviewerWorkflow:
      mode === admin
        ? undefined
        : {
            signingState: state,
            reviewers: reviewers.map((id) => ({ id })),
          },
  });
  const data = {
    purpose,
    previousReviewMode: previousMode,
    removedReviewers: removed,
  };
  if (mode === admin) {
    return { event_version: 2, type: "PurposeRiskAnalysisSelfAssigned", data };
  }
  return {
    event_version: 2,
    type:
      mode === writing
        ? "PurposeRiskAnalysisAssigned"
        : "PurposeRiskAnalysisWorkflowCreated",
    data: { ...data, addedReviewers: added },
  };
}

describe("risk analysis assignment recipients", () => {
  it.each([
    {
      name: "mode 2 draft",
      mode: signing,
      previousMode: signing,
      state: draft,
      sign: [],
      write: [],
      remove: ["z"],
    },
    {
      name: "mode 2 rejected",
      mode: signing,
      previousMode: signing,
      state: rejected,
      sign: [],
      write: [],
      remove: ["z"],
    },
    {
      name: "mode 2 submitted",
      mode: signing,
      previousMode: signing,
      state: submitted,
      sign: ["y"],
      write: [],
      remove: ["z"],
    },
    {
      name: "mode 3 unchanged",
      mode: writing,
      previousMode: writing,
      state: assigned,
      sign: [],
      write: ["y"],
      remove: ["z"],
    },
    {
      name: "mode 2 to 3",
      mode: writing,
      previousMode: signing,
      state: assigned,
      sign: [],
      write: ["x", "y"],
      remove: ["z"],
    },
    {
      name: "mode 3 to 2",
      mode: signing,
      previousMode: writing,
      state: draft,
      sign: [],
      write: [],
      remove: ["z", "x"],
    },
    {
      name: "mode 2 to 1",
      mode: admin,
      previousMode: signing,
      state: draft,
      sign: [],
      write: [],
      remove: ["z"],
    },
    {
      name: "mode 3 to 1",
      mode: admin,
      previousMode: writing,
      state: draft,
      sign: [],
      write: [],
      remove: ["z"],
    },
  ])(
    "selects recipients for $name",
    ({ mode, previousMode, state, sign, write, remove }) => {
      expect(
        getRiskAnalysisAssignmentRecipients(
          assignmentEvent({ mode, previousMode, state })
        )
      ).toEqual({
        signingReviewerIds: sign,
        writingReviewerIds: write,
        assignmentRemovedReviewerIds: remove,
      });
    }
  );

  it.each([undefined, admin])(
    "handles a first reviewer workflow from mode %s",
    (previousMode) => {
      for (const mode of [signing, writing]) {
        expect(
          getRiskAnalysisAssignmentRecipients(
            assignmentEvent({
              mode,
              previousMode,
              state: mode === signing ? draft : assigned,
              added: ["x", "y"],
              removed: [],
            })
          )
        ).toEqual({
          signingReviewerIds: [],
          writingReviewerIds: mode === writing ? ["x", "y"] : [],
          assignmentRemovedReviewerIds: [],
        });
      }
    }
  );

  it.each([
    {
      mode: signing,
      previousMode: writing,
      state: draft,
      write: [],
      remove: ["x", "y"],
    },
    {
      mode: writing,
      previousMode: signing,
      state: assigned,
      write: ["x", "y"],
      remove: [],
    },
    {
      mode: signing,
      previousMode: signing,
      state: rejected,
      write: [],
      remove: [],
    },
    {
      mode: writing,
      previousMode: writing,
      state: assigned,
      write: [],
      remove: [],
    },
  ])(
    "handles empty structural diffs from $previousMode to $mode",
    ({ mode, previousMode, state, write, remove }) => {
      expect(
        getRiskAnalysisAssignmentRecipients(
          assignmentEvent({ mode, previousMode, state, added: [], removed: [] })
        )
      ).toEqual({
        signingReviewerIds: [],
        writingReviewerIds: write,
        assignmentRemovedReviewerIds: remove,
      });
    }
  );

  it("notifies all current reviewers on every submit, regardless of previous timestamps", () => {
    const event: Extract<
      PurposeEventV2,
      { type: "PurposeRiskAnalysisSubmitted" }
    > = {
      event_version: 2,
      type: "PurposeRiskAnalysisSubmitted",
      data: {
        purpose: PurposeV2.create({
          reviewMode: signing,
          reviewerWorkflow: {
            signingState: submitted,
            reviewers: [
              { id: "x", sentToReviewerAt: 1n },
              { id: "y", sentToReviewerAt: 2n },
            ],
          },
        }),
      },
    };
    expect(getRiskAnalysisAssignmentRecipients(event)).toEqual({
      signingReviewerIds: ["x", "y"],
      writingReviewerIds: [],
      assignmentRemovedReviewerIds: [],
    });
  });

  it("does not notify on the first self assignment", () => {
    expect(
      getRiskAnalysisAssignmentRecipients(
        assignmentEvent({ mode: admin, state: draft, added: [], removed: [] })
      )
    ).toEqual({
      signingReviewerIds: [],
      writingReviewerIds: [],
      assignmentRemovedReviewerIds: [],
    });
  });

  it("rejects a missing purpose payload", () => {
    expect(() =>
      getRiskAnalysisAssignmentRecipients({
        event_version: 2,
        type: "PurposeRiskAnalysisSubmitted",
        data: {},
      })
    ).toThrow();
  });
});
