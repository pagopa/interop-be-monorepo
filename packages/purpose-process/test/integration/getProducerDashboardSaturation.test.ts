import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  DescriptorState,
  EService,
  EServiceId,
  PurposeVersionState,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  featureFlagNotEnabled,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  purposeService,
} from "../integrationUtils.js";

describe("getProducerDashboardSaturation", () => {
  const producerId: TenantId = generateId();
  const ctx = getMockContext({ authData: getMockAuthData(producerId) });
  const defaultQuery = {
    q: undefined,
    sortBy: "PERCENTAGE_DESC" as const,
    offset: 0,
    limit: 50,
  };

  const makeDescriptor = (
    version: string,
    dailyCallsTotal: number,
    state: DescriptorState = descriptorState.published
  ): Descriptor => ({
    ...getMockDescriptor(state),
    version,
    dailyCallsTotal,
    dailyCallsPerConsumer: dailyCallsTotal,
  });

  const makeEService = (
    name: string,
    descriptors: Descriptor[],
    producer: TenantId = producerId
  ): EService => ({
    ...getMockEService(generateId<EServiceId>(), producer, descriptors),
    name,
  });

  const addLoad = async (
    eservice: EService,
    descriptor: Descriptor,
    versions: Array<[PurposeVersionState, number]>,
    agreementStateValue: Agreement["state"] = agreementState.active
  ): Promise<void> => {
    const consumerId: TenantId = generateId();
    await addOneAgreement({
      ...getMockAgreement(eservice.id, consumerId, agreementStateValue),
      descriptorId: descriptor.id,
      producerId: eservice.producerId,
    });
    await addOnePurpose({
      ...getMockPurpose(
        versions.map(([state, dailyCalls]) => ({
          ...getMockPurposeVersion(state),
          dailyCalls,
        }))
      ),
      eserviceId: eservice.id,
      consumerId,
    });
  };

  beforeEach(() => {
    config.featureFlagProducerDashboard = true;
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
    config.producerDashboardNearThresholdPercentage = 80;
  });

  it("should compute the load per version without summing over the whole e-service", async () => {
    const v1 = makeDescriptor("1", 1000, descriptorState.deprecated);
    const v2 = makeDescriptor("2", 100);
    const eservice = makeEService("Anagrafe", [v1, v2]);
    await addOneEService(eservice);

    await addLoad(eservice, v1, [[purposeVersionState.active, 400]]);
    await addLoad(eservice, v1, [
      [purposeVersionState.active, 100],
      [purposeVersionState.waitingForApproval, 70],
    ]);
    await addLoad(
      eservice,
      v2,
      [[purposeVersionState.active, 120]],
      agreementState.suspended
    );
    // Not contributing: suspended version, inactive agreement
    await addLoad(eservice, v2, [[purposeVersionState.suspended, 999]]);
    await addLoad(
      eservice,
      v2,
      [[purposeVersionState.active, 999]],
      agreementState.archived
    );

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.summary).toEqual({
      overThreshold: 1,
      nearThreshold: 0,
      total: 2,
    });
    expect(result.pagination).toEqual({ offset: 0, limit: 50, totalCount: 2 });
    expect(result.results).toEqual([
      {
        eservice: { id: eservice.id, name: "Anagrafe" },
        descriptorId: v2.id,
        version: "2",
        activePurposesCount: 1,
        approvedDailyCalls: 120,
        dailyCallsTotal: 100,
        percentage: 120,
        waitingForApprovalDailyCalls: 0,
      },
      {
        eservice: { id: eservice.id, name: "Anagrafe" },
        descriptorId: v1.id,
        version: "1",
        activePurposesCount: 2,
        approvedDailyCalls: 500,
        dailyCallsTotal: 1000,
        percentage: 50,
        waitingForApprovalDailyCalls: 70,
      },
    ]);
  });

  it("should include versions without load and only the dashboard descriptor states", async () => {
    const included = [
      descriptorState.published,
      descriptorState.deprecated,
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
    ].map((state, i) => makeDescriptor(String(i + 1), 100, state));
    const excluded = [
      descriptorState.draft,
      descriptorState.waitingForApproval,
      descriptorState.archived,
    ].map((state, i) => makeDescriptor(String(i + 10), 100, state));
    await addOneEService(makeEService("Anagrafe", [...included, ...excluded]));

    const result = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, sortBy: "NAME_ASC" },
      ctx
    );

    expect(result.results.map((r) => r.descriptorId)).toEqual(
      included.map((d) => d.id)
    );
    expect(result.results.every((r) => r.percentage === 0)).toBe(true);
    expect(result.summary.total).toBe(5);
  });

  it("should count the over and near threshold versions on the exact ratio", async () => {
    const descriptors = ["1", "2", "3", "4", "5"].map((v) =>
      makeDescriptor(v, 1000)
    );
    const eservice = makeEService("Anagrafe", descriptors);
    await addOneEService(eservice);
    // 1000 (=100%, near), 1001 (>100%, over), 800 (=80%, neither), 801 (near), 0
    const loads = [1000, 1001, 800, 801];
    for (const [i, calls] of loads.entries()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await addLoad(eservice, descriptors[i]!, [
        [purposeVersionState.active, calls],
      ]);
    }

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.summary).toEqual({
      overThreshold: 1,
      nearThreshold: 2,
      total: 5,
    });
  });

  it("should use the configured near threshold and exclude its exact boundary", async () => {
    config.producerDashboardNearThresholdPercentage = 70;

    const descriptors = ["1", "2", "3"].map((version) =>
      makeDescriptor(version, 100)
    );
    const eservice = makeEService("Anagrafe", descriptors);
    await addOneEService(eservice);

    for (const [index, dailyCalls] of [70, 71, 101].entries()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await addLoad(eservice, descriptors[index]!, [
        [purposeVersionState.active, dailyCalls],
      ]);
    }

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.summary).toEqual({
      overThreshold: 1,
      nearThreshold: 1,
      total: 3,
    });
  });

  it("should return zero saturation for descriptors with no daily call capacity", async () => {
    const descriptor = makeDescriptor("1", 0);
    const eservice = makeEService("Anagrafe", [descriptor]);
    await addOneEService(eservice);
    await addLoad(eservice, descriptor, [[purposeVersionState.active, 25]]);

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.results).toEqual([
      {
        eservice: { id: eservice.id, name: "Anagrafe" },
        descriptorId: descriptor.id,
        version: "1",
        activePurposesCount: 1,
        approvedDailyCalls: 25,
        dailyCallsTotal: 0,
        percentage: 0,
        waitingForApprovalDailyCalls: 0,
      },
    ]);
    expect(result.summary).toEqual({
      overThreshold: 0,
      nearThreshold: 0,
      total: 1,
    });
  });

  it("should exclude load from agreements that are not active or suspended", async () => {
    const descriptor = makeDescriptor("1", 100);
    const eservice = makeEService("Anagrafe", [descriptor]);
    await addOneEService(eservice);
    await addLoad(
      eservice,
      descriptor,
      [[purposeVersionState.active, 80]],
      agreementState.pending
    );
    await addLoad(
      eservice,
      descriptor,
      [[purposeVersionState.waitingForApproval, 40]],
      agreementState.archived
    );

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.results[0]).toMatchObject({
      activePurposesCount: 0,
      approvedDailyCalls: 0,
      waitingForApprovalDailyCalls: 0,
      percentage: 0,
    });
    expect(result.summary).toEqual({
      overThreshold: 0,
      nearThreshold: 0,
      total: 1,
    });
  });

  it("should filter the results by e-service name, keeping the summary for all producer e-services", async () => {
    const a = makeDescriptor("1", 100);
    const b = makeDescriptor("1", 100);
    const anagrafe = makeEService("Anagrafe", [a]);
    const catasto = makeEService("Catasto", [b]);
    await addOneEService(anagrafe);
    await addOneEService(catasto);
    await addLoad(anagrafe, a, [[purposeVersionState.active, 150]]);
    await addLoad(catasto, b, [[purposeVersionState.active, 90]]);

    const result = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, q: "catas" },
      ctx
    );

    expect(result.results.map((r) => r.eservice.name)).toEqual(["Catasto"]);
    expect(result.summary).toEqual({
      overThreshold: 1,
      nearThreshold: 1,
      total: 2,
    });
    expect(result.pagination.totalCount).toBe(1);

    const emptyResult = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, q: "inesistente" },
      ctx
    );
    expect(emptyResult.results).toEqual([]);
    expect(emptyResult.pagination.totalCount).toBe(0);
    expect(emptyResult.summary).toEqual(result.summary);
  });

  it.each([
    ["PERCENTAGE_DESC", ["B", "A", "C"]],
    ["PERCENTAGE_ASC", ["C", "A", "B"]],
    ["NAME_ASC", ["A", "B", "C"]],
    ["NAME_DESC", ["C", "B", "A"]],
  ] as const)("should sort by %s", async (sortBy, expected) => {
    const loads: Record<string, number> = { A: 50, B: 90, C: 10 };
    for (const name of ["A", "B", "C"]) {
      const descriptor = makeDescriptor("1", 100);
      const eservice = makeEService(name, [descriptor]);
      await addOneEService(eservice);
      await addLoad(eservice, descriptor, [
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        [purposeVersionState.active, loads[name]!],
      ]);
    }

    const result = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, sortBy },
      ctx
    );

    expect(result.results.map((r) => r.eservice.name)).toEqual(expected);
  });

  it("should sort versions numerically within the same e-service", async () => {
    const descriptors = ["10", "2", "1"].map((v) => makeDescriptor(v, 100));
    await addOneEService(makeEService("Anagrafe", descriptors));

    const result = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, sortBy: "NAME_ASC" },
      ctx
    );

    expect(result.results.map((r) => r.version)).toEqual(["1", "2", "10"]);
  });

  it("should paginate and keep the summary of the whole set, even past the last page", async () => {
    const descriptors = ["1", "2", "3"].map((v) => makeDescriptor(v, 100));
    const eservice = makeEService("Anagrafe", descriptors);
    await addOneEService(eservice);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await addLoad(eservice, descriptors[0]!, [
      [purposeVersionState.active, 150],
    ]);

    const page = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, limit: 2, offset: 0 },
      ctx
    );
    expect(page.results).toHaveLength(2);
    expect(page.pagination).toEqual({ offset: 0, limit: 2, totalCount: 3 });
    expect(page.summary).toEqual({
      overThreshold: 1,
      nearThreshold: 0,
      total: 3,
    });

    const beyond = await purposeService.getProducerDashboardSaturation(
      { ...defaultQuery, q: "anagrafe", limit: 2, offset: 10 },
      ctx
    );
    expect(beyond.results).toEqual([]);
    expect(beyond.pagination.totalCount).toBe(3);
    expect(beyond.summary).toEqual(page.summary);
  });

  it("should only consider the e-services of the requester as producer", async () => {
    await addOneEService(makeEService("Mine", [makeDescriptor("1", 100)]));
    await addOneEService(
      makeEService("Other", [makeDescriptor("1", 100)], generateId<TenantId>())
    );

    const result = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );

    expect(result.results.map((r) => r.eservice.name)).toEqual(["Mine"]);
  });

  it("should handle producer delegations", async () => {
    const delegateId: TenantId = generateId();
    const delegated = makeEService("Delegated", [makeDescriptor("1", 100)]);
    await addOneEService(delegated);
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
        state: delegationState.active,
        eserviceId: delegated.id,
        delegatorId: producerId,
        delegateId,
      })
    );

    const asProducer = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      ctx
    );
    expect(asProducer.results).toEqual([]);

    const asDelegate = await purposeService.getProducerDashboardSaturation(
      defaultQuery,
      getMockContext({ authData: getMockAuthData(delegateId) })
    );
    expect(asDelegate.results.map((r) => r.eservice.name)).toEqual([
      "Delegated",
    ]);
  });

  it("should throw featureFlagNotEnabled if the feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;
    await expect(
      purposeService.getProducerDashboardSaturation(defaultQuery, ctx)
    ).rejects.toThrowError(
      featureFlagNotEnabled("featureFlagProducerDashboard")
    );
  });
});
