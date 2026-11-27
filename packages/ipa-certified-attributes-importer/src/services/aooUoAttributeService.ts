import {
  attributeKind,
  Attribute,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
  tenantUnitType,
} from "pagopa-interop-models";

import type { TenantSeed } from "./ipaCertifiedAttributesImporterService.js";
import type {
  InternalCertifiedAttribute,
  RegistryData,
} from "./openDataService.js";

import {
  toAttributeKey,
  toTenantKey,
} from "../utils/tenantAndAttributeKeySerialization.js";

function normalizeAttributeName(name: string): string {
  return name.trim().toLowerCase();
}

export function getAooUoAttributes(
  registryData: RegistryData,
  tenantUpsertData: TenantSeed[],
  platformAttributes: Attribute[],
  newRegistryAttributes: InternalCertifiedAttribute[]
): InternalCertifiedAttribute[] {
  const tenantKeysToUpsert = new Set(
    tenantUpsertData.map((tenant) =>
      toTenantKey({ origin: tenant.origin, value: tenant.originId })
    )
  );

  const aooNamesByCode = new Map(
    registryData.institutions
      .filter((i) => i.classification === tenantUnitType.AOO && i.subUnit)
      .map((i) => [i.originId, i.subUnit?.name])
  );

  // This list feeds seed generation with AOO/UO institutions whose tenants are
  // included in the upsert data; it excludes SCEC and sub-units with an AOO
  // code missing from the IPA registry.
  const aooUoInstitutionsForAttributeCreation =
    registryData.institutions.filter((institution) => {
      const institutionIsAooOrUo =
        institution.classification === tenantUnitType.AOO ||
        institution.classification === tenantUnitType.UO;

      const institutionIsNotEconomicAccountCompany =
        institution.category !==
        ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER;

      const institutionHasSubUnit = !!institution.subUnit;
      const institutionTenantIsIncludedInUpsertData = tenantKeysToUpsert.has(
        toTenantKey({
          origin: institution.origin,
          value: institution.originId,
        })
      );
      const institutionHasNoAooCodeOrReferencesKnownAoo =
        !institution.subUnit?.aooCode ||
        !!aooNamesByCode.get(institution.subUnit.aooCode);

      return (
        institutionIsAooOrUo &&
        institutionIsNotEconomicAccountCompany &&
        institutionHasSubUnit &&
        institutionTenantIsIncludedInUpsertData &&
        institutionHasNoAooCodeOrReferencesKnownAoo
      );
    });

  const aooUoAttributeSeeds = aooUoInstitutionsForAttributeCreation
    .flatMap((institution) => {
      if (!institution.subUnit) {
        return [];
      }

      const { name, entityName, aooCode } = institution.subUnit;
      const aooName = aooCode ? aooNamesByCode.get(aooCode) : undefined;

      const fullName = aooName
        ? `${name} di ${aooName} di ${entityName}`
        : `${name} di ${entityName}`;

      return [
        {
          origin: institution.origin,
          code: institution.originId,
          name: fullName,
          description: fullName,
        },
      ];
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const attributeNamesAlreadyUsed = getAttributeNamesAlreadyUsed(
    aooUoAttributeSeeds,
    platformAttributes,
    registryData.attributes
  );

  const aooUoAttributesWithResolvedNameCollisions =
    resolveAooUoAttributeNameCollisions(
      aooUoAttributeSeeds,
      attributeNamesAlreadyUsed
    );

  return removeDuplicateAooUoAttributes(
    aooUoAttributesWithResolvedNameCollisions,
    platformAttributes,
    newRegistryAttributes
  );
}

function removeDuplicateAooUoAttributes(
  aooUoAttributes: InternalCertifiedAttribute[],
  platformAttributes: Attribute[],
  newRegistryAttributes: InternalCertifiedAttribute[]
): InternalCertifiedAttribute[] {
  const attributeKeysAlreadyIncluded = new Set([
    ...platformAttributes
      .filter(
        (
          attribute
        ): attribute is Attribute & { origin: string; code: string } =>
          attribute.kind === attributeKind.certified &&
          !!attribute.origin &&
          !!attribute.code
      )
      .map(toAttributeKey),
    ...newRegistryAttributes.map(toAttributeKey),
  ]);

  return aooUoAttributes.filter((attribute) => {
    const key = toAttributeKey(attribute);
    const isNewAttribute = !attributeKeysAlreadyIncluded.has(key);
    attributeKeysAlreadyIncluded.add(key);
    return isNewAttribute;
  });
}

function getAttributeNamesAlreadyUsed(
  aooUoAttributeSeeds: InternalCertifiedAttribute[],
  platformAttributes: Attribute[],
  registryAttributes: InternalCertifiedAttribute[]
): Set<string> {
  const aooUoAttributeKeys = new Set(
    aooUoAttributeSeeds.map((attribute) =>
      toAttributeKey({
        origin: attribute.origin,
        code: attribute.code,
      })
    )
  );

  return new Set(
    [
      ...platformAttributes
        .filter((attribute) => {
          if (!attribute.origin || !attribute.code) return true;

          return !aooUoAttributeKeys.has(
            toAttributeKey({
              origin: attribute.origin,
              code: attribute.code,
            })
          );
        })
        .map((attribute) => attribute.name),
      ...registryAttributes.map((attribute) => attribute.name),
    ].map(normalizeAttributeName)
  );
}

function getDuplicateAttributeNames(
  attributes: InternalCertifiedAttribute[]
): Set<string> {
  const namesAlreadyEncountered = new Set<string>();

  return new Set(
    attributes
      .map((attribute) => normalizeAttributeName(attribute.name))
      .filter((name) => {
        if (namesAlreadyEncountered.has(name)) return true;
        namesAlreadyEncountered.add(name);
        return false;
      })
  );
}

// Resolves name collisions for generated AOO/UO attributes, both among themselves
// and against names already used by attributes in the platform or registry.
// Conflicting names are suffixed with the institution code (e.g. "Name (code)").
// TODO(WI 11, PIN-11248): If the suffixed name is also taken, the attribute is reported and counted as
// failed, then omitted from creation.
function resolveAooUoAttributeNameCollisions(
  attributes: InternalCertifiedAttribute[],
  attributeNamesAlreadyUsed: Set<string>
): InternalCertifiedAttribute[] {
  const duplicateAttributeNames = getDuplicateAttributeNames(attributes);

  return attributes.flatMap((attribute) => {
    const name = normalizeAttributeName(attribute.name);
    const hasNameCollision =
      duplicateAttributeNames.has(name) || attributeNamesAlreadyUsed.has(name);

    if (!hasNameCollision) return [attribute];

    const suffixedName = `${attribute.name} (${attribute.code})`;
    const normalizedSuffixedName = normalizeAttributeName(suffixedName);
    // TODO(WI 11, PIN-11248): Report and count this AOO/UO attribute as failed
    // while allowing the rest of the import to continue.
    if (attributeNamesAlreadyUsed.has(normalizedSuffixedName)) return [];

    attributeNamesAlreadyUsed.add(normalizedSuffixedName);

    return [
      {
        ...attribute,
        name: suffixedName,
        description: `${attribute.description} (${attribute.code})`,
      },
    ];
  });
}
