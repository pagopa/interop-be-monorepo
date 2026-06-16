import { type EServiceAttributeCertifiedDiscreteConfig } from "pagopa-interop-models";

export type CertifiedAttributeComparison = {
  id: string;
  discreteConfig?: EServiceAttributeCertifiedDiscreteConfig;
};

export const certifiedAttributeRequirementsEqual = (
  first: CertifiedAttributeComparison,
  second: CertifiedAttributeComparison
): boolean =>
  first.id === second.id &&
  first.discreteConfig?.threshold === second.discreteConfig?.threshold &&
  first.discreteConfig?.comparator === second.discreteConfig?.comparator &&
  Boolean(first.discreteConfig) === Boolean(second.discreteConfig);

export const certifiedAttributeIdsEqual = (
  first: CertifiedAttributeComparison,
  second: CertifiedAttributeComparison
): boolean => first.id === second.id;

export const certifiedGroupContainsAllByRequirement = (
  candidateGroup: CertifiedAttributeComparison[],
  requiredGroup: CertifiedAttributeComparison[]
): boolean =>
  requiredGroup.every((requiredAttribute) =>
    candidateGroup.some((candidateAttribute) =>
      certifiedAttributeRequirementsEqual(candidateAttribute, requiredAttribute)
    )
  );

export const certifiedGroupContainsAllById = (
  candidateGroup: CertifiedAttributeComparison[],
  requiredGroup: CertifiedAttributeComparison[]
): boolean =>
  requiredGroup.every((requiredAttribute) =>
    candidateGroup.some((candidateAttribute) =>
      certifiedAttributeIdsEqual(candidateAttribute, requiredAttribute)
    )
  );

export const findMatchingCertifiedGroup = <
  TGroup extends CertifiedAttributeComparison,
>(
  groups: TGroup[][],
  groupToMatch: CertifiedAttributeComparison[],
  usedGroupIndexes: Set<number>,
  groupMatches: (
    candidateGroup: TGroup[],
    groupToMatch: CertifiedAttributeComparison[]
  ) => boolean
): TGroup[] | undefined => {
  for (const [groupIndex, group] of groups.entries()) {
    if (usedGroupIndexes.has(groupIndex)) {
      continue;
    }

    if (!groupMatches(group, groupToMatch)) {
      continue;
    }

    usedGroupIndexes.add(groupIndex);
    return group;
  }

  return undefined;
};
