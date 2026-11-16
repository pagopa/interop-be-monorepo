import { bffApi } from "pagopa-interop-api-clients";
import { generateId, UserId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { sortRiskAnalysisAssignments } from "../src/services/purposeService.js";

const reviewerId = generateId<UserId>();

const makePurpose = ({
  sentToReviewerAt,
  signedAt,
  rejectedAt,
}: {
  sentToReviewerAt?: string;
  signedAt?: string;
  rejectedAt?: string;
}): bffApi.Purpose =>
  ({
    id: generateId(),
    reviewerWorkflow: {
      reviewers: [
        {
          userId: reviewerId,
          name: "Reviewer",
          surname: "User",
          sentToReviewerAt,
        },
      ],
      signingState: bffApi.RiskAnalysisSigningState.Values.ASSIGNED,
      signedAt,
      rejectedAt,
    },
  }) as unknown as bffApi.Purpose;

const olderPurpose = makePurpose({
  sentToReviewerAt: "2026-09-01T00:00:00.000Z",
  signedAt: "2026-09-01T00:00:00.000Z",
});
const newerPurpose = makePurpose({
  sentToReviewerAt: "2026-09-02T00:00:00.000Z",
  signedAt: "2026-09-02T00:00:00.000Z",
});

describe("sortRiskAnalysisAssignments", () => {
  it.each([
    [[bffApi.RiskAnalysisSigningState.Values.ASSIGNED]],
    [[bffApi.RiskAnalysisSigningState.Values.SUBMITTED]],
    [
      [
        bffApi.RiskAnalysisSigningState.Values.ASSIGNED,
        bffApi.RiskAnalysisSigningState.Values.SUBMITTED,
      ],
    ],
  ])(
    "sorts %s assignments by reviewer sentToReviewerAt descending",
    (signingStates) => {
      expect(
        sortRiskAnalysisAssignments(
          [olderPurpose, newerPurpose],
          signingStates,
          reviewerId
        )
      ).toEqual([newerPurpose, olderPurpose]);
    }
  );

  it.each([
    [[bffApi.RiskAnalysisSigningState.Values.REJECTED]],
    [[bffApi.RiskAnalysisSigningState.Values.SIGNED]],
    [
      [
        bffApi.RiskAnalysisSigningState.Values.REJECTED,
        bffApi.RiskAnalysisSigningState.Values.SIGNED,
      ],
    ],
  ])("sorts %s assignments by signedAt descending", (signingStates) => {
    expect(
      sortRiskAnalysisAssignments(
        [olderPurpose, newerPurpose],
        signingStates,
        reviewerId
      )
    ).toEqual([newerPurpose, olderPurpose]);
  });

  it("sorts signed or rejected assignments by rejectedAt when signedAt is unavailable", () => {
    const olderRejectedPurpose = makePurpose({
      rejectedAt: "2026-09-01T00:00:00.000Z",
    });
    const newerRejectedPurpose = makePurpose({
      rejectedAt: "2026-09-02T00:00:00.000Z",
    });

    expect(
      sortRiskAnalysisAssignments(
        [olderRejectedPurpose, newerRejectedPurpose],
        [bffApi.RiskAnalysisSigningState.Values.REJECTED],
        reviewerId
      )
    ).toEqual([newerRejectedPurpose, olderRejectedPurpose]);
  });
});
