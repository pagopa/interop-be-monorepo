import {
  matchesCertifiedDescriptorAttribute,
  matchesDiscreteThreshold,
} from "pagopa-interop-agreement-lifecycle";
import { getMockDescriptor } from "pagopa-interop-commons-test";
import {
  AttributeId,
  attributeCertifiedDiscreteComparator,
  AttributeCertifiedDiscreteComparator,
  Descriptor,
  descriptorState,
  EServiceAttributeCertified,
  EServiceAttributeCertifiedDiscrete,
  generateId,
  TenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  discreteConfigToInterval,
  getCustomizedDailyCallsPerConsumer,
  getEffectiveDailyCallsPerConsumer,
  isWithinDiscreteValueInterval,
  matchesCustomizedQuotaRule,
  toCustomizedQuotaRules,
} from "../../src/services/customizedQuotaRules.js";

const comparators = Object.values(
  attributeCertifiedDiscreteComparator
) as AttributeCertifiedDiscreteComparator[];

describe("discreteConfigToInterval", () => {
  it.each(comparators)(
    "is equivalent to matchesDiscreteThreshold for comparator %s",
    (comparator) => {
      for (const threshold of [1, 2, 10, 1000, 1000000000]) {
        const interval = discreteConfigToInterval({ threshold, comparator });
        for (let delta = -3; delta <= 3; delta++) {
          const value = threshold + delta;
          expect(
            isWithinDiscreteValueInterval(value, interval),
            `${value} ${comparator} ${threshold}`
          ).toBe(matchesDiscreteThreshold(value, threshold, comparator));
        }
      }
    }
  );

  it("throws for a non integer threshold", () => {
    expect(() =>
      discreteConfigToInterval({
        threshold: 1.5,
        comparator: attributeCertifiedDiscreteComparator.GT,
      })
    ).toThrow();
  });
});

describe("toCustomizedQuotaRules", () => {
  const certifiedWithQuota: EServiceAttributeCertified = {
    id: generateId<AttributeId>(),
    explicitAttributeVerification: false,
    dailyCallsPerConsumer: 2000,
  };
  const certifiedWithoutQuota: EServiceAttributeCertified = {
    id: generateId<AttributeId>(),
    explicitAttributeVerification: false,
  };
  const discreteWithQuota = (
    comparator: AttributeCertifiedDiscreteComparator,
    dailyCallsPerConsumer: number
  ): EServiceAttributeCertifiedDiscrete => ({
    id: generateId<AttributeId>(),
    explicitAttributeVerification: false,
    dailyCallsPerConsumer,
    discreteConfig: { threshold: 100, comparator },
  });
  const discreteAttributes = comparators.map((comparator, index) =>
    discreteWithQuota(comparator, 3000 + index * 1000)
  );

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    dailyCallsPerConsumer: 1000,
    attributes: {
      certified: [
        [certifiedWithQuota, certifiedWithoutQuota],
        discreteAttributes,
        [],
      ],
      declared: [],
      verified: [],
    },
  };

  describe.each([true, false])(
    "with featureFlagAttributeCertifiedDiscrete %s",
    (certifiedDiscreteEnabled) => {
      const rules = toCustomizedQuotaRules(
        descriptor,
        certifiedDiscreteEnabled
      );

      it("skips attributes without a customized quota", () => {
        expect(rules.map((rule) => rule.attributeId)).not.toContain(
          certifiedWithoutQuota.id
        );
      });
    }
  );

  it("ignores discrete attributes when the flag is disabled", () => {
    expect(
      toCustomizedQuotaRules(descriptor, false).map((rule) => rule.attributeId)
    ).toEqual([certifiedWithQuota.id]);
  });

  it("accepts discrete tenant attributes for plain certified requirements only with the flag enabled", () => {
    const [enabledRule] = toCustomizedQuotaRules(descriptor, true);
    const [disabledRule] = toCustomizedQuotaRules(descriptor, false);
    expect(enabledRule).toMatchObject({
      attributeId: certifiedWithQuota.id,
      acceptsCertified: true,
      acceptsCertifiedDiscrete: true,
      minDiscreteValue: null,
      maxDiscreteValue: null,
      excludedDiscreteValue: null,
    });
    expect(disabledRule).toMatchObject({
      attributeId: certifiedWithQuota.id,
      acceptsCertified: true,
      acceptsCertifiedDiscrete: false,
    });
  });
});

// Alignment of the extracted effective limit rule with the reference logic of
// the agreement-lifecycle (matchesCertifiedDescriptorAttribute) and with the
// computation getUpdatedQuotas used before the extraction.
describe("effective limit rule alignment", () => {
  const threshold = 100;
  const attributeId = generateId<AttributeId>();
  const revokedAt = new Date();

  const certifiedDescriptorAttribute: EServiceAttributeCertified = {
    id: attributeId,
    explicitAttributeVerification: false,
    dailyCallsPerConsumer: 2000,
  };
  const discreteDescriptorAttributes: EServiceAttributeCertifiedDiscrete[] =
    comparators.map((comparator) => ({
      id: attributeId,
      explicitAttributeVerification: false,
      dailyCallsPerConsumer: 2000,
      discreteConfig: { threshold, comparator },
    }));
  const descriptorAttributes: Array<
    [string, EServiceAttributeCertified | EServiceAttributeCertifiedDiscrete]
  > = [
    ["certified", certifiedDescriptorAttribute],
    ...discreteDescriptorAttributes.map(
      (
        attribute
      ): [
        string,
        EServiceAttributeCertified | EServiceAttributeCertifiedDiscrete,
      ] => [
        `discrete ${attribute.discreteConfig.comparator} ${threshold}`,
        attribute,
      ]
    ),
  ];

  const certifiedTenantAttribute = (
    id: AttributeId,
    revocationTimestamp?: Date
  ): TenantAttribute => ({
    id,
    type: tenantAttributeType.CERTIFIED,
    assignmentTimestamp: new Date(),
    revocationTimestamp,
  });
  const discreteTenantAttribute = (
    id: AttributeId,
    discreteValue: number,
    revocationTimestamp?: Date
  ): TenantAttribute => ({
    id,
    type: tenantAttributeType.CERTIFIED_DISCRETE,
    assignmentTimestamp: new Date(),
    revocationTimestamp,
    discreteValue,
  });

  const tenantAttributeScenarios: Array<[string, TenantAttribute[]]> = [
    ["no attributes", []],
    ["certified", [certifiedTenantAttribute(attributeId)]],
    ["revoked certified", [certifiedTenantAttribute(attributeId, revokedAt)]],
    ...[
      threshold - 2,
      threshold - 1,
      threshold,
      threshold + 1,
      threshold + 2,
    ].map((value): [string, TenantAttribute[]] => [
      `discrete ${value}`,
      [discreteTenantAttribute(attributeId, value)],
    ]),
    [
      "revoked discrete",
      [discreteTenantAttribute(attributeId, threshold, revokedAt)],
    ],
    [
      "declared with the same id",
      [
        {
          id: attributeId,
          type: tenantAttributeType.DECLARED,
          assignmentTimestamp: new Date(),
        },
      ],
    ],
    [
      "certified and discrete for another attribute",
      [
        certifiedTenantAttribute(generateId<AttributeId>()),
        discreteTenantAttribute(generateId<AttributeId>(), threshold),
      ],
    ],
  ];

  const descriptorWith = (
    certified: Descriptor["attributes"]["certified"],
    dailyCallsPerConsumer = 1000
  ): Descriptor => ({
    ...getMockDescriptor(descriptorState.published),
    dailyCallsPerConsumer,
    attributes: { certified, declared: [], verified: [] },
  });

  const legacyMaxDailyCallsPerConsumer = (
    descriptor: Descriptor,
    tenantAttributes: TenantAttribute[],
    certifiedDiscreteEnabled: boolean
  ): number =>
    descriptor.attributes.certified.flat().reduce((max, current) => {
      if (!current.dailyCallsPerConsumer) {
        return max;
      }
      if (
        !matchesCertifiedDescriptorAttribute(current, tenantAttributes, {
          certifiedDiscreteEnabled,
        })
      ) {
        return max;
      }
      return Math.max(max, current.dailyCallsPerConsumer);
    }, 0) || descriptor.dailyCallsPerConsumer;

  describe.each([true, false])(
    "with featureFlagAttributeCertifiedDiscrete %s",
    (certifiedDiscreteEnabled) => {
      it.each(
        descriptorAttributes.flatMap(([label, descriptorAttribute]) =>
          tenantAttributeScenarios.map(
            ([scenario, tenantAttributes]) =>
              [label, scenario, descriptorAttribute, tenantAttributes] as const
          )
        )
      )(
        "rules match like matchesCertifiedDescriptorAttribute (descriptor %s, tenant %s)",
        (_d, _t, descriptorAttribute, tenantAttributes) => {
          const rules = toCustomizedQuotaRules(
            descriptorWith([[descriptorAttribute]]),
            certifiedDiscreteEnabled
          );
          expect(
            rules.some((rule) =>
              matchesCustomizedQuotaRule(rule, tenantAttributes)
            )
          ).toBe(
            matchesCertifiedDescriptorAttribute(
              descriptorAttribute,
              tenantAttributes,
              { certifiedDiscreteEnabled }
            )
          );
        }
      );

      it("computes the same effective limit as the legacy getUpdatedQuotas computation", () => {
        const certifiedId = generateId<AttributeId>();
        const geId = generateId<AttributeId>();
        const neId = generateId<AttributeId>();
        const noQuotaId = generateId<AttributeId>();
        const descriptors = [
          descriptorWith([]),
          descriptorWith([
            [
              { ...certifiedDescriptorAttribute, id: certifiedId },
              {
                id: noQuotaId,
                explicitAttributeVerification: false,
              },
            ],
            [
              {
                id: geId,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: 3000,
                discreteConfig: {
                  threshold,
                  comparator: attributeCertifiedDiscreteComparator.GTE,
                },
              },
              {
                id: neId,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: 500,
                discreteConfig: {
                  threshold,
                  comparator: attributeCertifiedDiscreteComparator.NE,
                },
              },
            ],
            [],
          ]),
        ];
        const tenants: TenantAttribute[][] = [
          [],
          [certifiedTenantAttribute(certifiedId)],
          [discreteTenantAttribute(certifiedId, 1)],
          [certifiedTenantAttribute(noQuotaId)],
          [discreteTenantAttribute(geId, threshold)],
          [discreteTenantAttribute(geId, threshold - 1)],
          [discreteTenantAttribute(neId, threshold)],
          [discreteTenantAttribute(neId, threshold + 1)],
          [
            certifiedTenantAttribute(certifiedId),
            discreteTenantAttribute(geId, threshold + 5),
            discreteTenantAttribute(neId, 1),
          ],
          [
            certifiedTenantAttribute(certifiedId, revokedAt),
            discreteTenantAttribute(neId, 1),
          ],
        ];

        for (const descriptor of descriptors) {
          for (const tenantAttributes of tenants) {
            expect(
              getEffectiveDailyCallsPerConsumer(
                descriptor,
                tenantAttributes,
                certifiedDiscreteEnabled
              )
            ).toBe(
              legacyMaxDailyCallsPerConsumer(
                descriptor,
                tenantAttributes,
                certifiedDiscreteEnabled
              )
            );
          }
        }
      });
    }
  );

  it("returns no customized quota when no rule is satisfied", () => {
    expect(
      getCustomizedDailyCallsPerConsumer(
        toCustomizedQuotaRules(
          descriptorWith([[certifiedDescriptorAttribute]]),
          true
        ),
        []
      )
    ).toBeUndefined();
  });
});
