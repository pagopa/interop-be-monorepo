/* eslint-disable functional/no-let */
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeId,
  purposeVersionState,
  riskAnalysisSigningState,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  approvedRiskAnalysisToDigest,
  rejectedRiskAnalysisToDigest,
} from "../src/model/digestDataConverter.js";
import {
  ApprovedRiskAnalysisQueryResult,
  RejectedRiskAnalysisQueryResult,
} from "../src/services/readModelService.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenant,
  createMockEService,
  createMockTenant,
  createPurposeWithVersion,
  daysAgo,
  readModelService,
  TEST_LIMITS,
} from "./integrationUtils.js";

describe("risk analysis digest converters", () => {
  const consumerId = unsafeBrandId<TenantId>(generateId());
  const purposeId = unsafeBrandId<PurposeId>(generateId());
  const selfcareId = "test-selfcare-id";

  it("converts approved risk analysis and builds consumer purpose links", async () => {
    const signedAt = new Date().toISOString();
    const data: ApprovedRiskAnalysisQueryResult[] = [
      {
        purposeId,
        purposeTitle: "Approved purpose",
        consumerId,
        signedAt,
        totalCount: 1,
      },
    ];

    const result = await approvedRiskAnalysisToDigest(data, selfcareId);
    const link = new URL(result.items[0].link);

    expect(result.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: purposeId,
      name: "Approved purpose",
      producerName: "",
      signedAt,
    });
    expect(link.pathname).toBe("/emailDeepLink/purposeToConsumer");
    expect(link.searchParams.get("entityId")).toBe(purposeId);
    expect(link.searchParams.get("selfcareId")).toBe(selfcareId);
  });

  it("converts rejected risk analysis and builds consumer purpose links", async () => {
    const rejectedAt = new Date().toISOString();
    const data: RejectedRiskAnalysisQueryResult[] = [
      {
        purposeId,
        purposeTitle: "Rejected purpose",
        consumerId,
        rejectedAt,
        totalCount: 1,
      },
    ];

    const result = await rejectedRiskAnalysisToDigest(data, selfcareId);
    const link = new URL(result.items[0].link);

    expect(result.totalCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: purposeId,
      name: "Rejected purpose",
      producerName: "",
      rejectedAt,
    });
    expect(link.pathname).toBe("/emailDeepLink/purposeToConsumer");
    expect(link.searchParams.get("entityId")).toBe(purposeId);
    expect(link.searchParams.get("selfcareId")).toBe(selfcareId);
  });

  it("returns empty digests when no risk analyses are available", async () => {
    await expect(approvedRiskAnalysisToDigest([], null)).resolves.toEqual({
      items: [],
      totalCount: 0,
    });
    await expect(rejectedRiskAnalysisToDigest([], null)).resolves.toEqual({
      items: [],
      totalCount: 0,
    });
  });
});

describe("ReadModelService - risk analysis", () => {
  it("returns recent approved risk analyses for the consumer only", async () => {
    const producer = createMockTenant();
    const consumer = createMockTenant();
    const otherConsumer = createMockTenant();
    await Promise.all([
      addOneTenant(producer),
      addOneTenant(consumer),
      addOneTenant(otherConsumer),
    ]);

    const eservice = createMockEService(producer.id);
    await addOneEService(eservice);

    const signedAt = daysAgo(1);
    const approvedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.signed,
          signedAt,
        },
      }
    );
    const otherConsumerPurpose = createPurposeWithVersion(
      otherConsumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.signed,
          signedAt,
        },
      }
    );
    const oldApprovedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.signed,
          signedAt: daysAgo(10),
        },
      }
    );
    const approvedWithoutDate = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.signed,
        },
      }
    );
    const rejectedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.rejected,
          rejectedAt: signedAt,
        },
      }
    );

    await Promise.all(
      [
        approvedPurpose,
        otherConsumerPurpose,
        oldApprovedPurpose,
        approvedWithoutDate,
        rejectedPurpose,
      ].map(addOnePurpose)
    );

    const results = await readModelService.getApprovedRiskAnalysis(consumer.id);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      purposeId: approvedPurpose.id,
      purposeTitle: approvedPurpose.title,
      consumerId: consumer.id,
      totalCount: 1,
    });
    expect(new Date(results[0].signedAt).getTime()).toBe(signedAt.getTime());
  });

  it("returns recent rejected risk analyses and excludes rows without rejection dates", async () => {
    const producer = createMockTenant();
    const consumer = createMockTenant();
    await Promise.all([addOneTenant(producer), addOneTenant(consumer)]);

    const eservice = createMockEService(producer.id);
    await addOneEService(eservice);

    const rejectedAt = daysAgo(1);
    const rejectedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.rejected,
          rejectedAt,
        },
      }
    );
    const oldRejectedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.rejected,
          rejectedAt: daysAgo(10),
        },
      }
    );
    const approvedPurpose = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.signed,
          signedAt: rejectedAt,
        },
      }
    );
    const rejectedWithoutDate = createPurposeWithVersion(
      consumer.id,
      eservice.id,
      purposeVersionState.active,
      daysAgo(2),
      {
        reviewerWorkflow: {
          reviewers: [],
          signingState: riskAnalysisSigningState.rejected,
        },
      }
    );

    await Promise.all(
      [
        rejectedPurpose,
        oldRejectedPurpose,
        approvedPurpose,
        rejectedWithoutDate,
      ].map(addOnePurpose)
    );

    const results = await readModelService.getRejectedRiskAnalysis(consumer.id);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      purposeId: rejectedPurpose.id,
      purposeTitle: rejectedPurpose.title,
      consumerId: consumer.id,
      totalCount: 1,
    });
    expect(new Date(results[0].rejectedAt).getTime()).toBe(
      rejectedAt.getTime()
    );
  });

  it("orders approved risk analyses by signed date and applies the result limit", async () => {
    const producer = createMockTenant();
    const consumer = getMockTenant();
    await Promise.all([addOneTenant(producer), addOneTenant(consumer)]);

    const eservice = createMockEService(producer.id);
    await addOneEService(eservice);

    const purposes = Array.from({
      length: TEST_LIMITS.MAX_LIST_RESULTS + 1,
    }).map((_, index) =>
      createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(2),
        {
          reviewerWorkflow: {
            reviewers: [],
            signingState: riskAnalysisSigningState.signed,
            signedAt: new Date(Date.now() - (index + 1) * 60_000),
          },
        }
      )
    );
    await Promise.all(purposes.map(addOnePurpose));

    const results = await readModelService.getApprovedRiskAnalysis(consumer.id);

    expect(results).toHaveLength(TEST_LIMITS.MAX_LIST_RESULTS);
    expect(results.map((result) => result.purposeId)).toEqual(
      purposes.slice(0, TEST_LIMITS.MAX_LIST_RESULTS).map(({ id }) => id)
    );
    expect(results[0].totalCount).toBe(purposes.length);
  });

  it("orders rejected risk analyses by rejection date and applies the result limit", async () => {
    const producer = createMockTenant();
    const consumer = getMockTenant();
    await Promise.all([addOneTenant(producer), addOneTenant(consumer)]);

    const eservice = createMockEService(producer.id);
    await addOneEService(eservice);

    const purposes = Array.from({
      length: TEST_LIMITS.MAX_LIST_RESULTS + 1,
    }).map((_, index) =>
      createPurposeWithVersion(
        consumer.id,
        eservice.id,
        purposeVersionState.active,
        daysAgo(2),
        {
          reviewerWorkflow: {
            reviewers: [],
            signingState: riskAnalysisSigningState.rejected,
            rejectedAt: new Date(Date.now() - (index + 1) * 60_000),
          },
        }
      )
    );
    await Promise.all(purposes.map(addOnePurpose));

    const results = await readModelService.getRejectedRiskAnalysis(consumer.id);

    expect(results).toHaveLength(TEST_LIMITS.MAX_LIST_RESULTS);
    expect(results.map((result) => result.purposeId)).toEqual(
      purposes.slice(0, TEST_LIMITS.MAX_LIST_RESULTS).map(({ id }) => id)
    );
    expect(results[0].totalCount).toBe(purposes.length);
  });
});
