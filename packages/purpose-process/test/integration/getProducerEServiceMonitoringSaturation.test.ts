import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockEServiceAttribute,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  getMockCertifiedDiscreteTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AttributeId,
  attributeCertifiedDiscreteComparator,
  Descriptor,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  Tenant,
  TenantAttribute,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  tenantKind,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { config } from "../../src/config/config.js";
import {
  getCustomizedDailyCallsPerConsumer,
  getEffectiveDailyCallsPerConsumer,
  toCustomizedQuotaRules,
} from "../../src/services/customizedQuotaRules.js";
import {
  addOneAgreement,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
} from "../integrationUtils.js";

describe("getProducerEServiceMonitoringSaturation", () => {
  const producerId: TenantId = generateId();
  const customAttributeId: AttributeId = generateId();
  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    version: "3",
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
    attributes: {
      ...getMockDescriptor(descriptorState.published).attributes,
      certified: [
        [
          {
            ...getMockEServiceAttribute(customAttributeId),
            dailyCallsPerConsumer: 2000,
          },
        ],
      ],
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

  const addConsumer = async ({
    name,
    activeCalls,
    waitingCalls = 0,
    customQuota = false,
    state = agreementState.active,
  }: {
    name: string;
    activeCalls: number;
    waitingCalls?: number;
    customQuota?: boolean;
    state?: Agreement["state"];
  }): Promise<void> => {
    const consumerId: TenantId = generateId();
    const tenant: Tenant = {
      ...getMockTenant(
        consumerId,
        customQuota
          ? [
              {
                ...getMockCertifiedTenantAttribute(customAttributeId),
                revocationTimestamp: undefined,
              },
            ]
          : []
      ),
      name,
      kind: tenantKind.PA,
    };
    await addOneTenant(tenant);
    await addOneAgreement({
      ...getMockAgreement(eservice.id, consumerId, state),
      descriptorId: descriptor.id,
      producerId,
    });
    await addOnePurpose({
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: activeCalls,
        },
        ...(waitingCalls
          ? [
              {
                ...getMockPurposeVersion(
                  purposeVersionState.waitingForApproval
                ),
                dailyCalls: waitingCalls,
              },
            ]
          : []),
      ]),
      eserviceId: eservice.id,
      consumerId,
    });
  };

  beforeEach(async () => {
    config.featureFlagProducerDashboard = true;
    await addOneEService(eservice);
  });

  afterEach(() => {
    config.featureFlagProducerDashboard = false;
    config.featureFlagAttributeCertifiedDiscrete = false;
  });

  it("uses each active consumer's effective quota for saturation, sorting, and pagination", async () => {
    await addConsumer({
      name: "Comune B",
      activeCalls: 900,
      waitingCalls: 500,
      customQuota: true,
    });
    await addConsumer({ name: "Comune A", activeCalls: 500 });
    await addConsumer({
      name: "Comune C",
      activeCalls: 800,
      state: agreementState.suspended,
    });

    const result = await purposeService.getProducerEServiceMonitoringSaturation(
      eservice.id,
      descriptor.id,
      {
        q: undefined,
        sortBy: "PERCENTAGE_DESC",
        offset: 0,
        limit: 1,
      },
      ctx
    );

    expect(result).toEqual({
      eservice: { id: eservice.id, name: eservice.name },
      version: "3",
      otherVersions: [{ descriptorId: otherDescriptor.id, version: "2" }],
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
      customizedQuotaConsumers: 1,
      activeConsumers: 2,
      results: [
        {
          consumer: {
            id: expect.any(String),
            name: "Comune A",
            kind: tenantKind.PA,
          },
          activePurposesCount: 1,
          approvedDailyCalls: 500,
          dailyCallsPerConsumer: 1000,
          percentage: 50,
          waitingForApprovalDailyCalls: 0,
        },
      ],
      pagination: { offset: 0, limit: 1, totalCount: 2 },
    });

    const customConsumerResult =
      await purposeService.getProducerEServiceMonitoringSaturation(
        eservice.id,
        descriptor.id,
        {
          q: "Comune B",
          sortBy: "PERCENTAGE_DESC",
          offset: 0,
          limit: 10,
        },
        ctx
      );
    expect(customConsumerResult.results).toMatchObject([
      {
        consumer: { name: "Comune B" },
        activePurposesCount: 1,
        approvedDailyCalls: 900,
        dailyCallsPerConsumer: 2000,
        percentage: 45,
        waitingForApprovalDailyCalls: 500,
      },
    ]);
    expect(customConsumerResult.pagination.totalCount).toBe(1);
  });

  it("returns the unfiltered counters and the filtered total count on an empty page", async () => {
    await addConsumer({ name: "Comune A", activeCalls: 500 });
    await addConsumer({
      name: "Comune B",
      activeCalls: 900,
      customQuota: true,
    });

    const result = await purposeService.getProducerEServiceMonitoringSaturation(
      eservice.id,
      descriptor.id,
      { q: "Comune", sortBy: "NAME_ASC", offset: 10, limit: 10 },
      ctx
    );

    expect(result.results).toEqual([]);
    expect(result.pagination.totalCount).toBe(2);
    expect(result.activeConsumers).toBe(2);
    expect(result.customizedQuotaConsumers).toBe(1);
  });

  it("sorts by name descending, breaking ties by consumer id ascending", async () => {
    await addConsumer({ name: "Comune A", activeCalls: 1 });
    await addConsumer({ name: "comune b", activeCalls: 1 });
    await addConsumer({ name: "Comune B", activeCalls: 1 });

    const result = await purposeService.getProducerEServiceMonitoringSaturation(
      eservice.id,
      descriptor.id,
      { q: undefined, sortBy: "NAME_DESC", offset: 0, limit: 10 },
      ctx
    );

    const [first, second, third] = result.results;
    expect(first?.consumer.name.toLowerCase()).toBe("comune b");
    expect(second?.consumer.name.toLowerCase()).toBe("comune b");
    expect(third?.consumer.name).toBe("Comune A");
    expect(
      (first?.consumer.id ?? "").localeCompare(second?.consumer.id ?? "")
    ).toBeLessThan(0);
  });

  it("treats LIKE wildcards in q as literal characters", async () => {
    await addConsumer({ name: "Comune A", activeCalls: 1 });
    await addConsumer({ name: "Comune 100%", activeCalls: 1 });

    const result = await purposeService.getProducerEServiceMonitoringSaturation(
      eservice.id,
      descriptor.id,
      { q: "%", sortBy: "NAME_ASC", offset: 0, limit: 10 },
      ctx
    );

    expect(result.results.map((row) => row.consumer.name)).toEqual([
      "Comune 100%",
    ]);
    expect(result.pagination.totalCount).toBe(1);
    expect(result.activeConsumers).toBe(2);
  });

  it("returns the other versions sorted by version number", async () => {
    const versions = ["10", "2", "1", "9"];
    const otherDescriptors = versions.map((version) => ({
      ...getMockDescriptor(descriptorState.published),
      version,
    }));
    // A new id: the shared descriptor is already stored with the main e-service
    const selectedDescriptor: Descriptor = {
      ...descriptor,
      id: generateId(),
    };
    const multiVersionEService: EService = getMockEService(
      generateId<EServiceId>(),
      producerId,
      [
        ...otherDescriptors,
        { ...getMockDescriptor(descriptorState.draft), version: "11" },
        { ...getMockDescriptor(descriptorState.archived), version: "0" },
        selectedDescriptor,
      ]
    );
    await addOneEService(multiVersionEService);

    const result = await purposeService.getProducerEServiceMonitoringSaturation(
      multiVersionEService.id,
      selectedDescriptor.id,
      { q: undefined, sortBy: "NAME_ASC", offset: 0, limit: 10 },
      ctx
    );

    expect(result.otherVersions.map(({ version }) => version)).toEqual([
      "1",
      "2",
      "9",
      "10",
    ]);
  });

  // The effective limit is evaluated in SQL by the dashboard and in TypeScript by
  // getUpdatedQuotas: on the same data the two must always agree. The check goes
  // through the public service methods only: getRemainingDailyCalls is the
  // consumer-side endpoint backed by getUpdatedQuotas, so the dashboard limit
  // minus the dashboard approved calls must equal its remaining calls.
  describe.each([true, false])(
    "effective limit alignment with getUpdatedQuotas (featureFlagAttributeCertifiedDiscrete %s)",
    (certifiedDiscreteEnabled) => {
      const certifiedId: AttributeId = generateId();
      const gtId: AttributeId = generateId();
      const ltId: AttributeId = generateId();
      const eqId: AttributeId = generateId();
      const neId: AttributeId = generateId();
      const noQuotaId: AttributeId = generateId();
      const threshold = 100;
      const discrete = (
        id: AttributeId,
        comparator: (typeof attributeCertifiedDiscreteComparator)[keyof typeof attributeCertifiedDiscreteComparator],
        dailyCallsPerConsumer: number
      ): Descriptor["attributes"]["certified"][number][number] => ({
        id,
        explicitAttributeVerification: false,
        dailyCallsPerConsumer,
        discreteConfig: { threshold, comparator },
      });
      const alignmentDescriptor: Descriptor = {
        ...getMockDescriptor(descriptorState.published),
        dailyCallsPerConsumer: 1000,
        attributes: {
          certified: [
            [
              {
                id: certifiedId,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: 2000,
              },
              { id: noQuotaId, explicitAttributeVerification: false },
            ],
            [
              discrete(gtId, attributeCertifiedDiscreteComparator.GT, 3000),
              discrete(ltId, attributeCertifiedDiscreteComparator.LT, 4000),
            ],
            [
              discrete(eqId, attributeCertifiedDiscreteComparator.EQ, 5000),
              discrete(neId, attributeCertifiedDiscreteComparator.NE, 1500),
            ],
            // Same attributes again with other quotas: the highest satisfied
            // quota must win, whatever the order of the groups
            [
              {
                id: certifiedId,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: 2500,
              },
              discrete(gtId, attributeCertifiedDiscreteComparator.NE, 3500),
            ],
            [],
          ],
          declared: [],
          verified: [],
        },
      };
      const alignmentEService: EService = getMockEService(
        generateId<EServiceId>(),
        producerId,
        [alignmentDescriptor]
      );

      const certified = (
        id: AttributeId,
        revoked = false
      ): TenantAttribute => ({
        ...getMockCertifiedTenantAttribute(id),
        revocationTimestamp: revoked ? new Date() : undefined,
      });
      const discreteValue = (
        id: AttributeId,
        value: number,
        revoked = false
      ): TenantAttribute => ({
        ...getMockCertifiedDiscreteTenantAttribute(id),
        discreteValue: value,
        revocationTimestamp: revoked ? new Date() : undefined,
      });

      const tenantScenarios: TenantAttribute[][] = [
        [],
        [certified(certifiedId)],
        [certified(certifiedId, true)],
        [discreteValue(certifiedId, 1)],
        [certified(noQuotaId)],
        [discreteValue(gtId, threshold)],
        [discreteValue(gtId, threshold + 1)],
        [discreteValue(ltId, threshold - 1)],
        [discreteValue(ltId, threshold)],
        [discreteValue(eqId, threshold)],
        [discreteValue(eqId, threshold + 1)],
        [discreteValue(eqId, threshold, true)],
        [discreteValue(neId, threshold)],
        [discreteValue(neId, threshold - 1)],
        [certified(gtId)],
        [certified(certifiedId), discreteValue(neId, 1)],
        [
          certified(certifiedId),
          discreteValue(gtId, threshold + 1),
          discreteValue(eqId, threshold),
        ],
      ];

      beforeEach(() => {
        config.featureFlagAttributeCertifiedDiscrete = certifiedDiscreteEnabled;
      });

      it("computes, for every consumer, the same effective limit as getRemainingDailyCalls", async () => {
        await addOneEService(alignmentEService);
        const tenants: Array<{ tenant: Tenant; purposeId: PurposeId }> = [];
        for (const [index, attributes] of tenantScenarios.entries()) {
          const tenant: Tenant = {
            ...getMockTenant(generateId<TenantId>(), attributes),
            name: `Fruitore ${index}`,
          };
          const purpose: Purpose = {
            ...getMockPurpose([
              {
                ...getMockPurposeVersion(purposeVersionState.active),
                // distinct per consumer and below every quota of the descriptor
                dailyCalls: index + 1,
              },
            ]),
            eserviceId: alignmentEService.id,
            consumerId: tenant.id,
          };
          tenants.push({ tenant, purposeId: purpose.id });
          await addOneTenant(tenant);
          await addOnePurpose(purpose);
          await addOneAgreement({
            ...getMockAgreement(
              alignmentEService.id,
              tenant.id,
              agreementState.active
            ),
            descriptorId: alignmentDescriptor.id,
            producerId,
          });
        }

        const result =
          await purposeService.getProducerEServiceMonitoringSaturation(
            alignmentEService.id,
            alignmentDescriptor.id,
            { q: undefined, sortBy: "NAME_ASC", offset: 0, limit: 50 },
            ctx
          );
        expect(result.results).toHaveLength(tenants.length);

        const rules = toCustomizedQuotaRules(
          alignmentDescriptor,
          certifiedDiscreteEnabled
        );
        for (const { tenant, purposeId } of tenants) {
          const row = result.results.find(
            ({ consumer }) => consumer.id === tenant.id
          );
          expect(row, tenant.name).toBeDefined();
          const { remainingDailyCallsPerConsumer } =
            await purposeService.getRemainingDailyCalls({
              purposeId,
              ctx: getMockContext({ authData: getMockAuthData(tenant.id) }),
            });
          expect(
            (row?.dailyCallsPerConsumer ?? 0) - (row?.approvedDailyCalls ?? 0),
            tenant.name
          ).toBe(remainingDailyCallsPerConsumer);
          expect(row?.dailyCallsPerConsumer, tenant.name).toBe(
            getEffectiveDailyCallsPerConsumer(
              alignmentDescriptor,
              tenant.attributes,
              certifiedDiscreteEnabled
            )
          );
        }

        expect(result.customizedQuotaConsumers).toBe(
          tenants.filter(
            ({ tenant }) =>
              getCustomizedDailyCallsPerConsumer(rules, tenant.attributes) !==
              undefined
          ).length
        );
      });
    }
  );
});
