import {
  AttributeId,
  attributeCertifiedDiscreteComparator,
  Descriptor,
  EServiceAttributeCertifiedDiscreteConfig,
  genericInternalError,
  TenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

// A certified descriptor attribute that customizes the daily calls per consumer,
// normalized into plain data that SQL can check against the tenant attribute
// tables without knowing any business rule.
//
// All the decisions of matchesCertifiedDescriptorAttribute (agreement-lifecycle)
// are taken here, in TypeScript:
// - which tenant attribute types satisfy the descriptor attribute, depending on
//   the featureFlagAttributeCertifiedDiscrete flag;
// - the discrete threshold comparator, translated into an integer interval
//   [minDiscreteValue, maxDiscreteValue] minus an optional excluded value.
// SQL only checks ownership (id match + not revoked) and the interval.
//
// This is the single source of the effective limit rule: getUpdatedQuotas
// (validators.ts) evaluates it in TypeScript through
// getEffectiveDailyCallsPerConsumer, the producer dashboard consumer detail
// evaluates it in TypeScript through getEffectiveQuota, the producer dashboard
// saturation evaluates it in SQL
// (readModelServiceSQL.ts, customizedDailyCallsPerConsumer). Equivalence with
// matchesCertifiedDescriptorAttribute and between the TypeScript and SQL
// evaluations is enforced by customizedQuotaRules.test.ts and by the
// getProducerEServiceMonitoringSaturation integration tests.
export type CustomizedQuotaRule = {
  attributeId: AttributeId;
  dailyCallsPerConsumer: number;
  // satisfied by a non-revoked CERTIFIED tenant attribute
  acceptsCertified: boolean;
  // satisfied by a non-revoked CERTIFIED_DISCRETE tenant attribute whose
  // value is within the interval (null bounds mean "no bound")
  acceptsCertifiedDiscrete: boolean;
  minDiscreteValue: number | null;
  maxDiscreteValue: number | null;
  excludedDiscreteValue: number | null;
};

type DiscreteValueInterval = Pick<
  CustomizedQuotaRule,
  "minDiscreteValue" | "maxDiscreteValue" | "excludedDiscreteValue"
>;

const noDiscreteValueBounds: DiscreteValueInterval = {
  minDiscreteValue: null,
  maxDiscreteValue: null,
  excludedDiscreteValue: null,
};

// Tenant discrete values and descriptor thresholds are integers, so every
// comparator can be expressed as an inclusive integer interval, plus an
// excluded value for NE.
export const discreteConfigToInterval = ({
  threshold,
  comparator,
}: EServiceAttributeCertifiedDiscreteConfig): DiscreteValueInterval => {
  if (!Number.isInteger(threshold)) {
    throw genericInternalError(
      `Certified discrete threshold ${threshold} is not an integer`
    );
  }
  return match(comparator)
    .with(attributeCertifiedDiscreteComparator.GT, () => ({
      ...noDiscreteValueBounds,
      minDiscreteValue: threshold + 1,
    }))
    .with(attributeCertifiedDiscreteComparator.GTE, () => ({
      ...noDiscreteValueBounds,
      minDiscreteValue: threshold,
    }))
    .with(attributeCertifiedDiscreteComparator.LT, () => ({
      ...noDiscreteValueBounds,
      maxDiscreteValue: threshold - 1,
    }))
    .with(attributeCertifiedDiscreteComparator.LTE, () => ({
      ...noDiscreteValueBounds,
      maxDiscreteValue: threshold,
    }))
    .with(attributeCertifiedDiscreteComparator.EQ, () => ({
      ...noDiscreteValueBounds,
      minDiscreteValue: threshold,
      maxDiscreteValue: threshold,
    }))
    .with(attributeCertifiedDiscreteComparator.NE, () => ({
      ...noDiscreteValueBounds,
      excludedDiscreteValue: threshold,
    }))
    .exhaustive();
};

export const toCustomizedQuotaRules = (
  descriptor: Descriptor,
  certifiedDiscreteEnabled: boolean
): CustomizedQuotaRule[] =>
  descriptor.attributes.certified
    .flat()
    .flatMap<CustomizedQuotaRule>((attribute) => {
      if (!attribute.dailyCallsPerConsumer) {
        return [];
      }

      if ("discreteConfig" in attribute) {
        // With the flag disabled, discrete descriptor attributes are never satisfied
        if (!certifiedDiscreteEnabled) {
          return [];
        }
        return [
          {
            attributeId: attribute.id,
            dailyCallsPerConsumer: attribute.dailyCallsPerConsumer,
            acceptsCertified: false,
            acceptsCertifiedDiscrete: true,
            ...discreteConfigToInterval(attribute.discreteConfig),
          },
        ];
      }

      // A plain certified requirement is satisfied by a CERTIFIED tenant attribute
      // and, only with the flag enabled, by a CERTIFIED_DISCRETE one (any value)
      return [
        {
          attributeId: attribute.id,
          dailyCallsPerConsumer: attribute.dailyCallsPerConsumer,
          acceptsCertified: true,
          acceptsCertifiedDiscrete: certifiedDiscreteEnabled,
          ...noDiscreteValueBounds,
        },
      ];
    });

// TypeScript evaluation of a rule interval, the same checks done in SQL
export const isWithinDiscreteValueInterval = (
  value: number,
  {
    minDiscreteValue,
    maxDiscreteValue,
    excludedDiscreteValue,
  }: DiscreteValueInterval
): boolean =>
  (minDiscreteValue === null || value >= minDiscreteValue) &&
  (maxDiscreteValue === null || value <= maxDiscreteValue) &&
  (excludedDiscreteValue === null || value !== excludedDiscreteValue);

// TypeScript evaluation of a rule, the same checks done in SQL:
// ownership (id match + not revoked), accepted type and discrete interval.
export const matchesCustomizedQuotaRule = (
  rule: CustomizedQuotaRule,
  tenantAttributes: TenantAttribute[]
): boolean =>
  tenantAttributes.some((tenantAttribute) => {
    if (tenantAttribute.id !== rule.attributeId) {
      return false;
    }
    if (tenantAttribute.type === tenantAttributeType.CERTIFIED) {
      return rule.acceptsCertified && !tenantAttribute.revocationTimestamp;
    }
    if (tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE) {
      return (
        rule.acceptsCertifiedDiscrete &&
        !tenantAttribute.revocationTimestamp &&
        isWithinDiscreteValueInterval(tenantAttribute.discreteValue, rule)
      );
    }
    return false;
  });

// Highest customized quota among the satisfied rules, together with the
// attributes of the rules that determine it (more than one on ties),
// undefined when no rule is satisfied
const getSatisfiedCustomizedQuota = (
  rules: CustomizedQuotaRule[],
  tenantAttributes: TenantAttribute[]
):
  | { dailyCallsPerConsumer: number; attributeIds: AttributeId[] }
  | undefined => {
  const satisfiedRules = rules.filter((rule) =>
    matchesCustomizedQuotaRule(rule, tenantAttributes)
  );
  if (satisfiedRules.length === 0) {
    return undefined;
  }
  const dailyCallsPerConsumer = Math.max(
    ...satisfiedRules.map((rule) => rule.dailyCallsPerConsumer)
  );
  const attributeIds = [
    ...new Set(
      satisfiedRules
        .filter((rule) => rule.dailyCallsPerConsumer === dailyCallsPerConsumer)
        .map((rule) => rule.attributeId)
    ),
  ];
  return { dailyCallsPerConsumer, attributeIds };
};

// Highest customized quota among the satisfied rules, undefined when none is satisfied
export const getCustomizedDailyCallsPerConsumer = (
  rules: CustomizedQuotaRule[],
  tenantAttributes: TenantAttribute[]
): number | undefined =>
  getSatisfiedCustomizedQuota(rules, tenantAttributes)?.dailyCallsPerConsumer;

type EffectiveQuota = {
  dailyCallsPerConsumer: number;
  // attributes determining the customized quota, empty when the descriptor
  // quota applies
  customizedByAttributeIds: AttributeId[];
};

// Effective daily calls per consumer of a descriptor for a consumer:
// the highest satisfied customized quota, falling back to the descriptor quota.
export const getEffectiveQuota = (
  descriptor: Descriptor,
  tenantAttributes: TenantAttribute[],
  certifiedDiscreteEnabled: boolean
): EffectiveQuota => {
  const customizedQuota = getSatisfiedCustomizedQuota(
    toCustomizedQuotaRules(descriptor, certifiedDiscreteEnabled),
    tenantAttributes
  );
  return customizedQuota
    ? {
        dailyCallsPerConsumer: customizedQuota.dailyCallsPerConsumer,
        customizedByAttributeIds: customizedQuota.attributeIds,
      }
    : {
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        customizedByAttributeIds: [],
      };
};

export const getEffectiveDailyCallsPerConsumer = (
  descriptor: Descriptor,
  tenantAttributes: TenantAttribute[],
  certifiedDiscreteEnabled: boolean
): number =>
  getEffectiveQuota(descriptor, tenantAttributes, certifiedDiscreteEnabled)
    .dailyCallsPerConsumer;
