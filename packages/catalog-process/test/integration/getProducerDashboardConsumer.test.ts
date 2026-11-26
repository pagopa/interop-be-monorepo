import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementState,
  agreementState,
  delegationKind,
  delegationState,
  descriptorState,
  EService,
  generateId,
  PurposeVersionState,
  purposeVersionState,
  Tenant,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import { upsertPurpose } from "pagopa-interop-readmodel/testUtils";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
  readModelDB,
} from "../integrationUtils.js";

describe("getProducerDashboardConsumer", () => {
  const requesterId: TenantId = generateId<TenantId>();
  const context = getMockContext({ authData: getMockAuthData(requesterId) });
  const defaultQueries = { offset: 0, limit: 50 };
  // eslint-disable-next-line functional/no-let
  let consumer: Tenant;

  beforeEach(async () => {
    consumer = {
      ...getMockTenant(),
      name: "Comune di Roma",
      kind: tenantKind.PA,
    };
    await addOneTenant(consumer);
  });

  const addEService = async (
    name: string,
    producerId: TenantId = requesterId
  ): Promise<EService> => {
    const eservice: EService = {
      ...getMockEService(),
      name,
      producerId,
      descriptors: [
        {
          ...getMockDescriptor(),
          version: "1",
          state: descriptorState.published,
        },
        {
          ...getMockDescriptor(),
          version: "2",
          state: descriptorState.published,
        },
      ],
    };
    await addOneEService(eservice);
    return eservice;
  };

  const addAgreement = async (
    eservice: EService,
    state: AgreementState = agreementState.active,
    consumerId: TenantId = consumer.id,
    descriptorIndex = 0
  ): Promise<Agreement> => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      descriptorId: eservice.descriptors[descriptorIndex].id,
      consumerId,
      state,
    };
    await addOneAgreement(agreement);
    return agreement;
  };

  const addPurpose = async (
    eservice: EService,
    versions: Array<{ state: PurposeVersionState; dailyCalls: number }>,
    consumerId: TenantId = consumer.id
  ): Promise<void> => {
    await upsertPurpose(
      readModelDB,
      {
        ...getMockPurpose(
          versions.map(({ state, dailyCalls }) => ({
            ...getMockPurposeVersion(state),
            dailyCalls,
          }))
        ),
        eserviceId: eservice.id,
        consumerId,
      },
      0
    );
  };

  const getNames = async (
    queries: Parameters<typeof catalogService.getProducerDashboardConsumer>[1]
  ): Promise<string[]> =>
    (
      await catalogService.getProducerDashboardConsumer(
        consumer.id,
        queries,
        context
      )
    ).results.map((r) => r.eserviceName);

  it("should return an empty result without consumer for an unrelated consumer", async () => {
    const otherProducerEService = await addEService(
      "Other",
      generateId<TenantId>()
    );
    await addAgreement(otherProducerEService);
    const ownEService = await addEService("Own");
    await addAgreement(
      ownEService,
      agreementState.active,
      generateId<TenantId>()
    );

    expect(
      await catalogService.getProducerDashboardConsumer(
        consumer.id,
        defaultQueries,
        context
      )
    ).toEqual({
      consumer: undefined,
      eservicesCount: 0,
      totalCount: 0,
      results: [],
    });
  });

  it("should return an empty result for a non-existing consumer", async () => {
    expect(
      await catalogService.getProducerDashboardConsumer(
        generateId<TenantId>(),
        defaultQueries,
        context
      )
    ).toEqual({
      consumer: undefined,
      eservicesCount: 0,
      totalCount: 0,
      results: [],
    });
  });

  it("should return the header and rows of Active and Suspended agreements only", async () => {
    const active = await addEService("Active");
    const activeAgreement = await addAgreement(
      active,
      agreementState.active,
      consumer.id,
      1
    );
    const suspended = await addEService("Suspended");
    const suspendedAgreement = await addAgreement(
      suspended,
      agreementState.suspended
    );
    for (const state of [
      agreementState.draft,
      agreementState.pending,
      agreementState.archived,
      agreementState.rejected,
      agreementState.missingCertifiedAttributes,
    ]) {
      await addAgreement(await addEService(`Excluded ${state}`), state);
    }

    const result = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      defaultQueries,
      context
    );
    expect(result).toEqual({
      consumer: { id: consumer.id, name: consumer.name, kind: tenantKind.PA },
      eservicesCount: 2,
      totalCount: 2,
      results: [
        {
          eserviceId: active.id,
          eserviceName: "Active",
          descriptorId: active.descriptors[1].id,
          version: "2",
          agreementId: activeAgreement.id,
          agreementState: agreementState.active,
          activePurposesCount: 0,
          approvedDailyCalls: 0,
        },
        {
          eserviceId: suspended.id,
          eserviceName: "Suspended",
          descriptorId: suspended.descriptors[0].id,
          version: "1",
          agreementId: suspendedAgreement.id,
          agreementState: agreementState.suspended,
          activePurposesCount: 0,
          approvedDailyCalls: 0,
        },
      ],
    });
  });

  it("should omit the consumer kind when it is not set", async () => {
    const tenantWithoutKind: Tenant = { ...getMockTenant(), kind: undefined };
    await addOneTenant(tenantWithoutKind);
    await addAgreement(
      await addEService("Anagrafe"),
      agreementState.active,
      tenantWithoutKind.id
    );
    const result = await catalogService.getProducerDashboardConsumer(
      tenantWithoutKind.id,
      defaultQueries,
      context
    );
    expect(result.consumer).toEqual({
      id: tenantWithoutKind.id,
      name: tenantWithoutKind.name,
      kind: undefined,
    });
  });

  it("should include actively delegated e-services and exclude other producers' e-services", async () => {
    const owned = await addEService("Owned");
    const delegated = await addEService("Delegated", generateId<TenantId>());
    const revoked = await addEService("Revoked", generateId<TenantId>());
    const consumerDelegated = await addEService(
      "Consumer delegated",
      generateId<TenantId>()
    );
    const otherDelegate = await addEService(
      "Other delegate",
      generateId<TenantId>()
    );
    const otherProducer = await addEService(
      "Other producer",
      generateId<TenantId>()
    );
    const delegations = [
      {
        eservice: delegated,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: revoked,
        state: delegationState.revoked,
        kind: delegationKind.delegatedProducer,
        delegateId: requesterId,
      },
      {
        eservice: consumerDelegated,
        state: delegationState.active,
        kind: delegationKind.delegatedConsumer,
        delegateId: requesterId,
      },
      {
        eservice: otherDelegate,
        state: delegationState.active,
        kind: delegationKind.delegatedProducer,
        delegateId: generateId<TenantId>(),
      },
    ];
    for (const { eservice, ...delegation } of delegations) {
      await addOneDelegation({
        ...getMockDelegation(delegation),
        eserviceId: eservice.id,
        delegatorId: eservice.producerId,
      });
    }
    for (const eservice of [
      owned,
      delegated,
      revoked,
      consumerDelegated,
      otherDelegate,
      otherProducer,
    ]) {
      await addAgreement(eservice);
    }

    const result = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      defaultQueries,
      context
    );
    expect(result.eservicesCount).toBe(2);
    expect(result.results.map((r) => r.eserviceId)).toEqual([
      delegated.id,
      owned.id,
    ]);
  });

  it("should count only Active purpose versions of the consumer on the e-service", async () => {
    const eservice = await addEService("Anagrafe");
    const other = await addEService("Other");
    await addAgreement(eservice);
    await addAgreement(other);
    await addPurpose(eservice, [
      { state: purposeVersionState.archived, dailyCalls: 1 },
      { state: purposeVersionState.active, dailyCalls: 1000 },
      { state: purposeVersionState.waitingForApproval, dailyCalls: 5000 },
    ]);
    await addPurpose(eservice, [
      { state: purposeVersionState.active, dailyCalls: 2000 },
    ]);
    await addPurpose(eservice, [
      { state: purposeVersionState.suspended, dailyCalls: 7000 },
    ]);
    await addPurpose(eservice, [
      { state: purposeVersionState.waitingForApproval, dailyCalls: 8000 },
    ]);
    await addPurpose(eservice, [
      { state: purposeVersionState.draft, dailyCalls: 9000 },
    ]);
    // Purposes of other consumers do not contribute.
    await addPurpose(
      eservice,
      [{ state: purposeVersionState.active, dailyCalls: 4000 }],
      generateId<TenantId>()
    );

    const result = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      defaultQueries,
      context
    );
    expect(
      result.results.map(
        ({ eserviceName, activePurposesCount, approvedDailyCalls }) => ({
          eserviceName,
          activePurposesCount,
          approvedDailyCalls,
        })
      )
    ).toEqual([
      {
        eserviceName: "Anagrafe",
        activePurposesCount: 2,
        approvedDailyCalls: 3000,
      },
      { eserviceName: "Other", activePurposesCount: 0, approvedDailyCalls: 0 },
    ]);
  });

  it("should filter by e-service name escaping special characters, without affecting eservicesCount", async () => {
    for (const name of ["Anagrafe 100%", "Anagrafe 1000", "a_b", "axb"]) {
      await addAgreement(await addEService(name));
    }

    const percent = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      { ...defaultQueries, q: "100%" },
      context
    );
    expect(percent.results.map((r) => r.eserviceName)).toEqual([
      "Anagrafe 100%",
    ]);
    expect(percent.totalCount).toBe(1);
    expect(percent.eservicesCount).toBe(4);
    expect(percent.consumer?.id).toBe(consumer.id);

    expect(await getNames({ ...defaultQueries, q: "_" })).toEqual(["a_b"]);
    expect(await getNames({ ...defaultQueries, q: "ANAGRAFE" })).toEqual([
      "Anagrafe 100%",
      "Anagrafe 1000",
    ]);

    const noMatch = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      { ...defaultQueries, q: "missing" },
      context
    );
    expect(noMatch).toEqual({
      consumer: { id: consumer.id, name: consumer.name, kind: tenantKind.PA },
      eservicesCount: 4,
      totalCount: 0,
      results: [],
    });
  });

  it("should sort by every sort option with stable tie-breakers", async () => {
    const beta = await addEService("beta");
    const alpha = await addEService("Alpha");
    const gamma = await addEService("Gamma");
    for (const eservice of [alpha, beta, gamma]) {
      await addAgreement(eservice);
    }
    await addPurpose(beta, [
      { state: purposeVersionState.active, dailyCalls: 300 },
    ]);
    await addPurpose(gamma, [
      { state: purposeVersionState.active, dailyCalls: 300 },
    ]);
    await addPurpose(alpha, [
      { state: purposeVersionState.active, dailyCalls: 100 },
    ]);

    expect(await getNames(defaultQueries)).toEqual(["Alpha", "beta", "Gamma"]);
    expect(await getNames({ ...defaultQueries, sortBy: "NAME_ASC" })).toEqual([
      "Alpha",
      "beta",
      "Gamma",
    ]);
    expect(await getNames({ ...defaultQueries, sortBy: "NAME_DESC" })).toEqual([
      "Gamma",
      "beta",
      "Alpha",
    ]);
    expect(
      await getNames({ ...defaultQueries, sortBy: "DAILY_CALLS_DESC" })
    ).toEqual(["beta", "Gamma", "Alpha"]);
    expect(
      await getNames({ ...defaultQueries, sortBy: "DAILY_CALLS_ASC" })
    ).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it("should use the e-service id as tie-breaker for equal names", async () => {
    const first = await addEService("Same");
    const second = await addEService("Same");
    await addAgreement(first);
    await addAgreement(second);
    const result = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      defaultQueries,
      context
    );
    expect(result.results.map((r) => r.eserviceId)).toEqual(
      [first.id, second.id].sort()
    );
  });

  it("should paginate and report totalCount", async () => {
    for (const name of ["A", "B", "C", "D", "E"]) {
      await addAgreement(await addEService(name));
    }

    const page = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      { offset: 1, limit: 2 },
      context
    );
    expect(page.results.map((r) => r.eserviceName)).toEqual(["B", "C"]);
    expect(page.totalCount).toBe(5);
    expect(page.eservicesCount).toBe(5);

    expect(await getNames({ offset: 4, limit: 2 })).toEqual(["E"]);

    const beyond = await catalogService.getProducerDashboardConsumer(
      consumer.id,
      { offset: 10, limit: 2 },
      context
    );
    expect(beyond).toEqual({
      consumer: { id: consumer.id, name: consumer.name, kind: tenantKind.PA },
      eservicesCount: 5,
      totalCount: 5,
      results: [],
    });
  });
});
