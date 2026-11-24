import {
  getMockAgreement,
  getMockAttribute,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockCertifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AttributeId,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Purpose,
  PurposeVersion,
  PurposeVersionState,
  Tenant,
  TenantId,
  agreementState,
  attributeKind,
  delegationKind,
  delegationState,
  descriptorState,
  featureFlagNotEnabled,
  generateId,
  purposeVersionState,
  tenantKind,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  descriptorNotFound,
  eserviceNotFound,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
} from "../integrationUtils.js";

describe("getProducerEServiceMonitoringConsumerPurposes", () => {
  const producerId: TenantId = generateId();
  const customAttributeId: AttributeId = generateId();
  const tieAttributeId: AttributeId = generateId();
  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    version: "3",
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
    attributes: {
      certified: [
        [
          {
            id: customAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 2000,
          },
          {
            id: tieAttributeId,
            explicitAttributeVerification: false,
            dailyCallsPerConsumer: 2000,
          },
        ],
      ],
      declared: [],
      verified: [],
    },
  };
  const otherDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.deprecated),
    version: "2",
  };
  const eservice: EService = getMockEService(
    generateId<EServiceId>(),
    producerId,
    [otherDescriptor, descriptor]
  );
  const ctx = getMockContext({ authData: getMockAuthData(producerId) });

  const defaultFilters = {
    q: undefined,
    sortBy: "DATE_DESC" as const,
    states: [] as PurposeVersionState[],
    includeArchived: false,
  };
  const defaultPagination = { offset: 0, limit: 50 };

  const day = (n: number): Date => new Date(Date.UTC(2026, 0, n));

  const addConsumer = async ({
    attributeIds = [],
    agreementStateValue = agreementState.active,
    agreementDescriptorId = descriptor.id,
    withAgreement = true,
  }: {
    attributeIds?: AttributeId[];
    agreementStateValue?: Agreement["state"];
    agreementDescriptorId?: DescriptorId;
    withAgreement?: boolean;
  } = {}): Promise<Tenant> => {
    const consumer: Tenant = {
      ...getMockTenant(
        generateId<TenantId>(),
        attributeIds.map((id) => ({
          ...getMockCertifiedTenantAttribute(id),
          revocationTimestamp: undefined,
        }))
      ),
      name: "Comune di Roma",
      kind: tenantKind.PA,
    };
    await addOneTenant(consumer);
    if (withAgreement) {
      await addOneAgreement({
        ...getMockAgreement(eservice.id, consumer.id, agreementStateValue),
        descriptorId: agreementDescriptorId,
        producerId,
      });
    }
    return consumer;
  };

  const version = (
    state: PurposeVersionState,
    dailyCalls: number,
    createdAt: Date
  ): PurposeVersion => ({
    ...getMockPurposeVersion(state),
    dailyCalls,
    createdAt,
  });

  const addPurpose = async (
    consumerId: TenantId,
    {
      title,
      versions,
      updatedAt,
      createdAt = day(1),
      suspendedByConsumer,
      suspendedByProducer,
    }: {
      title: string;
      versions: PurposeVersion[];
      updatedAt?: Date;
      createdAt?: Date;
      suspendedByConsumer?: boolean;
      suspendedByProducer?: boolean;
    }
  ): Promise<Purpose> => {
    const purpose: Purpose = {
      ...getMockPurpose(versions),
      title,
      eserviceId: eservice.id,
      consumerId,
      createdAt,
      updatedAt,
      suspendedByConsumer,
      suspendedByProducer,
    };
    await addOnePurpose(purpose);
    return purpose;
  };

  beforeEach(async () => {
    config.featureFlagProducerDashboard = true;
    await addOneEService(eservice);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
    config.featureFlagAttributeCertifiedDiscrete = false;
  });

  it("returns the consumer summary and the displayed version of each purpose", async () => {
    const customAttribute = {
      ...getMockAttribute(attributeKind.certified, customAttributeId),
      name: "Comuni",
    };
    await addOneAttribute(customAttribute);
    const consumer = await addConsumer({ attributeIds: [customAttributeId] });

    const quotaChange = await addPurpose(consumer.id, {
      title: "Cambio stima",
      versions: [
        version(purposeVersionState.active, 600, day(1)),
        version(purposeVersionState.waitingForApproval, 900, day(2)),
      ],
      updatedAt: day(10),
      suspendedByConsumer: false,
      suspendedByProducer: false,
    });
    const newPurpose = await addPurpose(consumer.id, {
      title: "Nuova",
      versions: [version(purposeVersionState.waitingForApproval, 300, day(1))],
      updatedAt: day(9),
    });
    const suspended = await addPurpose(consumer.id, {
      title: "Sospesa",
      versions: [version(purposeVersionState.suspended, 200, day(1))],
      updatedAt: day(8),
      suspendedByConsumer: true,
      suspendedByProducer: false,
    });
    const rejected = await addPurpose(consumer.id, {
      title: "Rifiutata",
      versions: [version(purposeVersionState.rejected, 100, day(1))],
      updatedAt: day(7),
    });
    // Excluded: archived (by default), draft, other consumers' purposes
    await addPurpose(consumer.id, {
      title: "Archiviata",
      versions: [version(purposeVersionState.archived, 50, day(1))],
      updatedAt: day(11),
    });
    await addPurpose(consumer.id, {
      title: "Bozza",
      versions: [version(purposeVersionState.draft, 50, day(1))],
    });
    const otherConsumer = await addConsumer();
    await addPurpose(otherConsumer.id, {
      title: "Altro fruitore",
      versions: [version(purposeVersionState.active, 700, day(1))],
      updatedAt: day(12),
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result).toEqual({
      eservice: { id: eservice.id, name: eservice.name },
      version: "3",
      consumer: { id: consumer.id, name: consumer.name, kind: tenantKind.PA },
      dailyCallsPerConsumer: 2000,
      customizedByAttribute: {
        id: customAttributeId,
        name: "Comuni",
        kind: "CERTIFIED",
      },
      approvedDailyCalls: 600,
      percentage: 30,
      waitingForApprovalPurposes: 2,
      results: [
        {
          purposeId: quotaChange.id,
          title: "Cambio stima",
          dailyCalls: 600,
          state: "ACTIVE",
          suspendedByConsumer: false,
          suspendedByProducer: false,
          updatedAt: day(10).toISOString(),
          hasPendingQuotaChange: true,
        },
        {
          purposeId: newPurpose.id,
          title: "Nuova",
          dailyCalls: 300,
          state: "WAITING_FOR_APPROVAL",
          updatedAt: day(9).toISOString(),
          hasPendingQuotaChange: false,
        },
        {
          purposeId: suspended.id,
          title: "Sospesa",
          dailyCalls: 200,
          state: "SUSPENDED",
          suspendedByConsumer: true,
          suspendedByProducer: false,
          updatedAt: day(8).toISOString(),
          hasPendingQuotaChange: false,
        },
        {
          purposeId: rejected.id,
          title: "Rifiutata",
          dailyCalls: 100,
          state: "REJECTED",
          updatedAt: day(7).toISOString(),
          hasPendingQuotaChange: false,
        },
      ],
      pagination: { offset: 0, limit: 50, totalCount: 4 },
    });
  });

  it("is consistent with the saturation of the consumer (D9) and with the descriptor waiting counters (D2/D3)", async () => {
    await addOneAttribute(
      getMockAttribute(attributeKind.certified, customAttributeId)
    );
    const consumer = await addConsumer({ attributeIds: [customAttributeId] });
    await addPurpose(consumer.id, {
      title: "Attiva",
      versions: [
        version(purposeVersionState.active, 1234, day(1)),
        version(purposeVersionState.waitingForApproval, 2000, day(2)),
      ],
    });
    await addPurpose(consumer.id, {
      title: "Nuova",
      versions: [version(purposeVersionState.waitingForApproval, 10, day(1))],
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );
    const saturation =
      await purposeService.getProducerEServiceMonitoringSaturation(
        eservice.id,
        descriptor.id,
        { q: undefined, sortBy: "NAME_ASC", offset: 0, limit: 50 },
        ctx
      );
    const monitoring =
      await purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        ctx
      );

    const consumerSaturation = saturation.results.find(
      (r) => r.consumer.id === consumer.id
    );
    expect(consumerSaturation).toBeDefined();
    expect(result.dailyCallsPerConsumer).toBe(
      consumerSaturation?.dailyCallsPerConsumer
    );
    expect(result.approvedDailyCalls).toBe(
      consumerSaturation?.approvedDailyCalls
    );
    expect(result.percentage).toBe(consumerSaturation?.percentage);
    expect(result.waitingForApprovalPurposes).toBe(
      monitoring.waitingForApprovalNewPurposes +
        monitoring.waitingForApprovalQuotaChanges
    );
    expect(result.results.filter((p) => p.hasPendingQuotaChange)).toHaveLength(
      monitoring.waitingForApprovalQuotaChanges
    );
  });

  it.each([
    {
      label: "an Active version and a WaitingForApproval one",
      versions: [
        purposeVersionState.active,
        purposeVersionState.waitingForApproval,
      ],
      expected: true,
    },
    {
      label: "a Suspended version and a WaitingForApproval one",
      versions: [
        purposeVersionState.suspended,
        purposeVersionState.waitingForApproval,
      ],
      expected: true,
    },
    {
      label: "only a WaitingForApproval version (new purpose)",
      versions: [purposeVersionState.waitingForApproval],
      expected: false,
    },
    {
      label: "an Active version and a Rejected one (rejected quota change)",
      versions: [purposeVersionState.active, purposeVersionState.rejected],
      expected: false,
    },
    {
      label: "an Archived version and an Active one",
      versions: [purposeVersionState.archived, purposeVersionState.active],
      expected: false,
    },
  ] as const)(
    "returns hasPendingQuotaChange $expected for a purpose with $label",
    async ({ versions, expected }) => {
      const consumer = await addConsumer();
      await addPurpose(consumer.id, {
        title: "Finalità",
        versions: versions.map((state, index) =>
          version(state, 100 * (index + 1), day(index + 1))
        ),
      });

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, ...defaultPagination },
          ctx
        );

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.hasPendingQuotaChange).toBe(expected);
    }
  );

  it("returns the consumer data for a consumer with a suspended agreement on the descriptor, consistently with the descriptor waiting counters (D2/D3)", async () => {
    const consumer = await addConsumer({
      agreementStateValue: agreementState.suspended,
    });
    const purpose = await addPurpose(consumer.id, {
      title: "Attiva",
      versions: [
        version(purposeVersionState.active, 500, day(1)),
        version(purposeVersionState.waitingForApproval, 800, day(2)),
      ],
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );
    const monitoring =
      await purposeService.getProducerEServiceMonitoringPurposes(
        eservice.id,
        descriptor.id,
        ctx
      );

    expect(result.consumer).toEqual({
      id: consumer.id,
      name: consumer.name,
      kind: consumer.kind,
    });
    expect(result.dailyCallsPerConsumer).toBe(1000);
    expect(result.approvedDailyCalls).toBe(500);
    expect(result.percentage).toBe(50);
    expect(result.waitingForApprovalPurposes).toBe(1);
    expect(result.waitingForApprovalPurposes).toBe(
      monitoring.waitingForApprovalNewPurposes +
        monitoring.waitingForApprovalQuotaChanges
    );
    expect(result.results.map((p) => p.purposeId)).toEqual([purpose.id]);
    expect(result.pagination.totalCount).toBe(1);
  });

  it.each([
    { label: "no agreement", missing: true },
    { label: "an agreement on another descriptor", otherVersion: true },
    {
      label: "a suspended agreement on another descriptor",
      agreementStateValue: agreementState.suspended,
      otherVersion: true,
    },
    {
      label: "a pending agreement",
      agreementStateValue: agreementState.pending,
    },
    {
      label: "an archived agreement",
      agreementStateValue: agreementState.archived,
    },
  ])(
    "returns an empty response without consumer data for a consumer with $label",
    async ({ missing, agreementStateValue, otherVersion }) => {
      const consumer = await addConsumer({
        withAgreement: !missing,
        agreementStateValue,
        agreementDescriptorId: otherVersion
          ? otherDescriptor.id
          : descriptor.id,
      });
      await addPurpose(consumer.id, {
        title: "Attiva",
        versions: [version(purposeVersionState.active, 500, day(1))],
      });

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, ...defaultPagination },
          ctx
        );

      expect(result).toEqual({
        eservice: { id: eservice.id, name: eservice.name },
        version: "3",
        dailyCallsPerConsumer: 1000,
        approvedDailyCalls: 0,
        percentage: 0,
        waitingForApprovalPurposes: 0,
        results: [],
        pagination: { offset: 0, limit: 50, totalCount: 0 },
      });
    }
  );

  it("returns an empty response for an unknown consumer", async () => {
    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        generateId<TenantId>(),
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result.consumer).toBeUndefined();
    expect(result.results).toEqual([]);
  });

  it("uses the descriptor quota when the consumer has no customizing attribute", async () => {
    const consumer = await addConsumer();
    await addPurpose(consumer.id, {
      title: "Attiva",
      versions: [version(purposeVersionState.active, 999, day(1))],
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result.dailyCallsPerConsumer).toBe(1000);
    expect(result.customizedByAttribute).toBeUndefined();
    expect(result.approvedDailyCalls).toBe(999);
    expect(result.percentage).toBe(100);
  });

  it("displays the attribute with the lowest name when more attributes determine the quota", async () => {
    await addOneAttribute({
      ...getMockAttribute(attributeKind.certified, customAttributeId),
      name: "Beta",
    });
    await addOneAttribute({
      ...getMockAttribute(attributeKind.certified, tieAttributeId),
      name: "Alfa",
    });
    const consumer = await addConsumer({
      attributeIds: [customAttributeId, tieAttributeId],
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result.dailyCallsPerConsumer).toBe(2000);
    expect(result.customizedByAttribute).toEqual({
      id: tieAttributeId,
      name: "Alfa",
      kind: "CERTIFIED",
    });
  });

  it("omits the customizing attribute when it is missing from the read model, keeping the customized quota", async () => {
    const consumer = await addConsumer({ attributeIds: [customAttributeId] });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result.dailyCallsPerConsumer).toBe(2000);
    expect(result.customizedByAttribute).toBeUndefined();
  });

  it("displays the latest Active/Suspended/Archived version over newer waiting or rejected versions", async () => {
    const consumer = await addConsumer();
    const reactivated = await addPurpose(consumer.id, {
      title: "Riattivata",
      versions: [
        version(purposeVersionState.archived, 100, day(1)),
        version(purposeVersionState.active, 200, day(2)),
        version(purposeVersionState.rejected, 300, day(3)),
      ],
    });

    const result =
      await purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      );

    expect(result.results).toEqual([
      expect.objectContaining({
        purposeId: reactivated.id,
        dailyCalls: 200,
        state: "ACTIVE",
      }),
    ]);
  });

  describe("filters", () => {
    const addFilterPurposes = async (): Promise<{
      consumer: Tenant;
      active: Purpose;
      waiting: Purpose;
      archived: Purpose;
    }> => {
      const consumer = await addConsumer();
      const active = await addPurpose(consumer.id, {
        title: "Attiva",
        versions: [
          version(purposeVersionState.active, 100, day(1)),
          version(purposeVersionState.waitingForApproval, 200, day(2)),
        ],
        updatedAt: day(3),
      });
      const waiting = await addPurpose(consumer.id, {
        title: "In attesa",
        versions: [
          version(purposeVersionState.waitingForApproval, 100, day(1)),
        ],
        updatedAt: day(2),
      });
      const archived = await addPurpose(consumer.id, {
        title: "Archiviata",
        versions: [version(purposeVersionState.archived, 100, day(1))],
        updatedAt: day(1),
      });
      return { consumer, active, waiting, archived };
    };

    it.each([
      {
        label: "states on the displayed version",
        states: [purposeVersionState.waitingForApproval],
        includeArchived: false,
        expected: ["waiting"],
      },
      {
        label: "includeArchived",
        states: [],
        includeArchived: true,
        expected: ["active", "waiting", "archived"],
      },
      {
        label: "states ARCHIVED with includeArchived false (AND, empty)",
        states: [purposeVersionState.archived],
        includeArchived: false,
        expected: [],
      },
      {
        label: "states ARCHIVED with includeArchived true",
        states: [purposeVersionState.archived],
        includeArchived: true,
        expected: ["archived"],
      },
    ] as const)(
      "applies $label",
      async ({ states, includeArchived, expected }) => {
        const { consumer, ...purposes } = await addFilterPurposes();

        const result =
          await purposeService.getProducerEServiceMonitoringConsumerPurposes(
            eservice.id,
            descriptor.id,
            consumer.id,
            {
              ...defaultFilters,
              states: [...states],
              includeArchived,
              ...defaultPagination,
            },
            ctx
          );

        expect(result.results.map((r) => r.purposeId)).toEqual(
          expected.map((key) => purposes[key].id)
        );
        expect(result.pagination.totalCount).toBe(expected.length);
      }
    );

    it("treats LIKE wildcards in q as literal characters", async () => {
      const consumer = await addConsumer();
      const percent = await addPurpose(consumer.id, {
        title: "Sconto 100%",
        versions: [version(purposeVersionState.active, 100, day(1))],
      });
      await addPurpose(consumer.id, {
        title: "Sconto 1000",
        versions: [version(purposeVersionState.active, 100, day(1))],
      });

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, q: "100%", ...defaultPagination },
          ctx
        );

      expect(result.results.map((r) => r.purposeId)).toEqual([percent.id]);
    });

    it("searches the title case-insensitively", async () => {
      const consumer = await addConsumer();
      const purpose = await addPurpose(consumer.id, {
        title: "Anagrafe Residenti",
        versions: [version(purposeVersionState.active, 100, day(1))],
      });

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, q: "residenti", ...defaultPagination },
          ctx
        );

      expect(result.results.map((r) => r.purposeId)).toEqual([purpose.id]);
    });
  });

  describe("sorting and pagination", () => {
    const addSortPurposes = async (): Promise<{
      consumer: Tenant;
      b: Purpose;
      a: Purpose;
      c: Purpose;
    }> => {
      const consumer = await addConsumer();
      const b = await addPurpose(consumer.id, {
        title: "b finalità",
        versions: [version(purposeVersionState.active, 100, day(1))],
        updatedAt: day(5),
      });
      // No updatedAt: sorted by createdAt
      const a = await addPurpose(consumer.id, {
        title: "A finalità",
        versions: [version(purposeVersionState.active, 100, day(1))],
        createdAt: day(3),
      });
      const c = await addPurpose(consumer.id, {
        title: "C finalità",
        versions: [version(purposeVersionState.active, 100, day(1))],
        updatedAt: day(4),
      });
      return { consumer, b, a, c };
    };

    it.each([
      { sortBy: "DATE_DESC", expected: ["b", "c", "a"] },
      { sortBy: "DATE_ASC", expected: ["a", "c", "b"] },
      { sortBy: "NAME_ASC", expected: ["a", "b", "c"] },
      { sortBy: "NAME_DESC", expected: ["c", "b", "a"] },
    ] as const)(
      "sorts by $sortBy, falling back to createdAt when updatedAt is missing",
      async ({ sortBy, expected }) => {
        const { consumer, ...purposes } = await addSortPurposes();

        const result =
          await purposeService.getProducerEServiceMonitoringConsumerPurposes(
            eservice.id,
            descriptor.id,
            consumer.id,
            { ...defaultFilters, sortBy, ...defaultPagination },
            ctx
          );

        expect(result.results.map((r) => r.purposeId)).toEqual(
          expected.map((key) => purposes[key].id)
        );
      }
    );

    it("returns the createdAt as updatedAt when updatedAt is missing", async () => {
      const { consumer } = await addSortPurposes();

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, sortBy: "NAME_ASC", ...defaultPagination },
          ctx
        );

      expect(result.results[0]?.updatedAt).toBe(day(3).toISOString());
    });

    it("breaks ties by purpose id ascending", async () => {
      const consumer = await addConsumer();
      const purposes = await Promise.all(
        [1, 2, 3].map(() =>
          addPurpose(consumer.id, {
            title: "Stessa finalità",
            versions: [version(purposeVersionState.active, 100, day(1))],
            updatedAt: day(2),
          })
        )
      );

      const result =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, sortBy: "NAME_DESC", ...defaultPagination },
          ctx
        );

      expect(result.results.map((r) => r.purposeId)).toEqual(
        purposes.map((p) => p.id).sort()
      );
    });

    it("paginates and returns the filtered total count on an empty page", async () => {
      const { consumer, ...purposes } = await addSortPurposes();

      const page =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, sortBy: "NAME_ASC", offset: 1, limit: 1 },
          ctx
        );
      expect(page.results.map((r) => r.purposeId)).toEqual([purposes.b.id]);
      expect(page.pagination).toEqual({ offset: 1, limit: 1, totalCount: 3 });

      const emptyPage =
        await purposeService.getProducerEServiceMonitoringConsumerPurposes(
          eservice.id,
          descriptor.id,
          consumer.id,
          { ...defaultFilters, offset: 10, limit: 1 },
          ctx
        );
      expect(emptyPage.results).toEqual([]);
      expect(emptyPage.pagination).toEqual({
        offset: 10,
        limit: 1,
        totalCount: 3,
      });
      expect(emptyPage.consumer).toBeDefined();
    });
  });

  it("should allow the active producer delegate and reject the producer", async () => {
    const consumer = await addConsumer();
    const delegate = getMockAuthData();
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: delegate.organizationId,
      delegatorId: producerId,
      state: delegationState.active,
    });
    await addOneDelegation(delegation);

    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        getMockContext({ authData: delegate })
      )
    ).resolves.toBeDefined();

    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumer.id,
        { ...defaultFilters, ...defaultPagination },
        ctx
      )
    ).rejects.toThrow(
      tenantIsNotTheDelegatedProducer(producerId, delegation.id)
    );
  });

  it("should throw tenantIsNotTheProducer if the requester is not the producer", async () => {
    const requester = getMockAuthData();
    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        generateId<TenantId>(),
        { ...defaultFilters, ...defaultPagination },
        getMockContext({ authData: requester })
      )
    ).rejects.toThrow(tenantIsNotTheProducer(requester.organizationId));
  });

  it("should throw eserviceNotFound if the e-service does not exist", async () => {
    const unknownId = generateId<EServiceId>();
    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        unknownId,
        descriptor.id,
        generateId<TenantId>(),
        { ...defaultFilters, ...defaultPagination },
        ctx
      )
    ).rejects.toThrow(eserviceNotFound(unknownId));
  });

  it("should throw descriptorNotFound if the descriptor does not exist", async () => {
    const unknownId = generateId<DescriptorId>();
    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        unknownId,
        generateId<TenantId>(),
        { ...defaultFilters, ...defaultPagination },
        ctx
      )
    ).rejects.toThrow(descriptorNotFound(eservice.id, unknownId));
  });

  it("should throw tenantNotFound if the consumer with an active agreement does not exist", async () => {
    const consumerId = generateId<TenantId>();
    await addOneAgreement({
      ...getMockAgreement(eservice.id, consumerId, agreementState.active),
      descriptorId: descriptor.id,
      producerId,
    });
    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        consumerId,
        { ...defaultFilters, ...defaultPagination },
        ctx
      )
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it("should throw featureFlagNotEnabled if the feature flag is disabled", async () => {
    config.featureFlagProducerDashboard = false;
    await expect(
      purposeService.getProducerEServiceMonitoringConsumerPurposes(
        eservice.id,
        descriptor.id,
        generateId<TenantId>(),
        { ...defaultFilters, ...defaultPagination },
        ctx
      )
    ).rejects.toThrow(featureFlagNotEnabled("featureFlagProducerDashboard"));
  });
});
