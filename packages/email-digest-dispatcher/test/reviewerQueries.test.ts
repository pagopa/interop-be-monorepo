import {
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  DescriptorId,
  descriptorState,
  EService,
  generateId,
  Purpose,
  purposeVersionState,
  ReviewerWorkflow,
  riskAnalysisReviewMode,
  RiskAnalysisSigningState,
  riskAnalysisSigningState,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { reviewerRiskAnalysesToDigest } from "../src/model/digestDataConverter.js";
import {
  buildEserviceLink,
  buildPurposeLink,
} from "../src/services/deeplinkBuilder.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  createPurposeWithVersion,
  daysAgo,
  readModelService,
  TEST_LIMITS,
  TEST_TIME_WINDOWS,
} from "./integrationUtils.js";

const setupConsumerWithEService = async (): Promise<{
  consumerId: TenantId;
  eservice: EService;
}> => {
  const producer = getMockTenant();
  const consumer = getMockTenant();
  await addOneTenant(producer);
  await addOneTenant(consumer);

  const eservice: EService = {
    ...getMockEService(),
    producerId: producer.id,
    descriptors: [
      {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
      },
    ],
  };
  await addOneEService(eservice);

  return { consumerId: consumer.id, eservice };
};

/**
 * Creates a purpose whose risk analysis is assigned to the given reviewers,
 * with a version in the given state.
 */
const createReviewerPurpose = ({
  consumerId,
  eserviceId,
  reviewerIds,
  signingState,
  versionState = purposeVersionState.draft,
  sentToReviewerAt = daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
  workflowOverrides,
}: {
  consumerId: TenantId;
  eserviceId: EService["id"];
  reviewerIds: UserId[];
  signingState: RiskAnalysisSigningState;
  versionState?: Purpose["versions"][number]["state"];
  sentToReviewerAt?: Date;
  workflowOverrides?: Partial<ReviewerWorkflow>;
}): Purpose =>
  createPurposeWithVersion(
    consumerId,
    eserviceId,
    versionState,
    daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
    {
      riskAnalysisReviewMode:
        signingState === riskAnalysisSigningState.assigned
          ? riskAnalysisReviewMode.reviewerWritesReviewerSigns
          : riskAnalysisReviewMode.adminWritesReviewerSigns,
      reviewerWorkflow: {
        reviewers: reviewerIds.map((id) => ({ id, sentToReviewerAt })),
        signingState,
        ...workflowOverrides,
      },
    }
  );

describe("ReadModelService - getReviewerRiskAnalysesToApprove", () => {
  it("should return the submitted risk analyses assigned to the reviewer", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    const purpose = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId],
      signingState: riskAnalysisSigningState.submitted,
    });
    await addOnePurpose(purpose);

    const results = await readModelService.getReviewerRiskAnalysesToApprove(
      consumerId,
      reviewerId
    );

    expect(results).toEqual([
      {
        purposeId: purpose.id,
        purposeTitle: purpose.title,
        eserviceId: eservice.id,
        eserviceName: eservice.name,
        totalCount: 1,
      },
    ]);
  });

  it("should not return risk analyses of purposes of another consumer", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const otherConsumer = getMockTenant();
    await addOneTenant(otherConsumer);
    const reviewerId = generateId<UserId>();

    await addOnePurpose(
      createReviewerPurpose({
        consumerId: otherConsumer.id,
        eserviceId: eservice.id,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.submitted,
      })
    );

    const results = await readModelService.getReviewerRiskAnalysesToApprove(
      consumerId,
      reviewerId
    );

    expect(results).toEqual([]);
  });

  it("should not return risk analyses in other signing states", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    for (const signingState of [
      riskAnalysisSigningState.draft,
      riskAnalysisSigningState.assigned,
      riskAnalysisSigningState.signed,
      riskAnalysisSigningState.rejected,
    ]) {
      await addOnePurpose(
        createReviewerPurpose({
          consumerId,
          eserviceId: eservice.id,
          reviewerIds: [reviewerId],
          signingState,
        })
      );
    }

    const results = await readModelService.getReviewerRiskAnalysesToApprove(
      consumerId,
      reviewerId
    );

    expect(results).toEqual([]);
  });

  it("should not return risk analyses assigned to another reviewer", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    await addOnePurpose(
      createReviewerPurpose({
        consumerId,
        eserviceId: eservice.id,
        reviewerIds: [generateId<UserId>()],
        signingState: riskAnalysisSigningState.submitted,
      })
    );

    const results = await readModelService.getReviewerRiskAnalysesToApprove(
      consumerId,
      reviewerId
    );

    expect(results).toEqual([]);
  });

  it("should limit results and order them from most to least recently sent", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    const purposes = Array.from({ length: 7 }, (_, index) =>
      createReviewerPurpose({
        consumerId,
        eserviceId: eservice.id,
        reviewerIds: [reviewerId],
        signingState: riskAnalysisSigningState.submitted,
        sentToReviewerAt: daysAgo(index + 1),
      })
    );
    for (const purpose of purposes) {
      await addOnePurpose(purpose);
    }

    const results = await readModelService.getReviewerRiskAnalysesToApprove(
      consumerId,
      reviewerId
    );

    expect(results).toHaveLength(TEST_LIMITS.MAX_LIST_RESULTS);
    expect(results[0].totalCount).toBe(7);
    expect(results.map((r) => r.purposeId)).toEqual(
      purposes.slice(0, TEST_LIMITS.MAX_LIST_RESULTS).map((p) => p.id)
    );
  });
});

describe("ReadModelService - getReviewerRiskAnalysesToFill", () => {
  it("should return the risk analyses the reviewer has to write and sign", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    const assigned = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId],
      signingState: riskAnalysisSigningState.assigned,
    });
    const submitted = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId],
      signingState: riskAnalysisSigningState.submitted,
    });
    await addOnePurpose(assigned);
    await addOnePurpose(submitted);

    const results = await readModelService.getReviewerRiskAnalysesToFill(
      consumerId,
      reviewerId
    );

    expect(results.map((r) => r.purposeId)).toEqual([assigned.id]);
  });
});

describe("ReadModelService - getReviewerPublishedPurposes", () => {
  it("should return purposes published in the time window with a risk analysis assigned to the reviewer", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    const purpose = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId],
      signingState: riskAnalysisSigningState.signed,
      versionState: purposeVersionState.active,
    });
    await addOnePurpose({
      ...purpose,
      versions: purpose.versions.map((version) => ({
        ...version,
        firstActivationAt: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      })),
    });

    const results = await readModelService.getReviewerPublishedPurposes(
      consumerId,
      reviewerId
    );

    expect(results.map((r) => r.purposeId)).toEqual([purpose.id]);
  });

  it("should not return purposes published outside the time window", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();

    const purpose = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId],
      signingState: riskAnalysisSigningState.signed,
      versionState: purposeVersionState.active,
    });
    await addOnePurpose({
      ...purpose,
      versions: purpose.versions.map((version) => ({
        ...version,
        firstActivationAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
      })),
    });

    const results = await readModelService.getReviewerPublishedPurposes(
      consumerId,
      reviewerId
    );

    expect(results).toEqual([]);
  });
});

describe("ReadModelService - getReviewerRiskAnalysesSignedByOthers", () => {
  it("should return risk analyses signed by another reviewer in the time window", async () => {
    const { consumerId, eservice } = await setupConsumerWithEService();
    const reviewerId = generateId<UserId>();
    const otherReviewerId = generateId<UserId>();

    const signedByOther = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId, otherReviewerId],
      signingState: riskAnalysisSigningState.signed,
      workflowOverrides: {
        signedBy: otherReviewerId,
        signedAt: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      },
    });
    const signedBySelf = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId, otherReviewerId],
      signingState: riskAnalysisSigningState.signed,
      workflowOverrides: {
        signedBy: reviewerId,
        signedAt: daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
      },
    });
    const signedTooLongAgo = createReviewerPurpose({
      consumerId,
      eserviceId: eservice.id,
      reviewerIds: [reviewerId, otherReviewerId],
      signingState: riskAnalysisSigningState.signed,
      workflowOverrides: {
        signedBy: otherReviewerId,
        signedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
      },
    });
    await addOnePurpose(signedByOther);
    await addOnePurpose(signedBySelf);
    await addOnePurpose(signedTooLongAgo);

    const results =
      await readModelService.getReviewerRiskAnalysesSignedByOthers(
        consumerId,
        reviewerId
      );

    expect(results.map((r) => r.purposeId)).toEqual([signedByOther.id]);
  });
});

describe("reviewerRiskAnalysesToDigest", () => {
  const eserviceId = generateId<EService["id"]>();
  const item = {
    purposeId: generateId<Purpose["id"]>(),
    purposeTitle: "Finalità",
    eserviceId,
    eserviceName: "E-service",
    totalCount: 7,
  };

  it("should build the e-service link when the descriptor is known", () => {
    const descriptorId = generateId<DescriptorId>();

    expect(
      reviewerRiskAnalysesToDigest(
        [item],
        "selfcare-id",
        new Map([[eserviceId, descriptorId]])
      )
    ).toEqual({
      items: [
        {
          purposeTitle: "Finalità",
          purposeLink: buildPurposeLink(item.purposeId, false, "selfcare-id"),
          eserviceName: "E-service",
          eserviceLink: buildEserviceLink(
            eserviceId,
            descriptorId,
            "selfcare-id"
          ),
        },
      ],
      totalCount: 7,
    });
  });

  it("should leave the e-service without link when the descriptor is unknown", () => {
    const digest = reviewerRiskAnalysesToDigest([item], "selfcare-id");

    expect(digest.items[0].eserviceLink).toBeUndefined();
  });
});
