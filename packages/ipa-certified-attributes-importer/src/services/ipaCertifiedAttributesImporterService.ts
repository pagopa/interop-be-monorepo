import { createHash } from "crypto";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { InteropHeaders, Logger, delay } from "pagopa-interop-commons";
import {
  attributeKind,
  Tenant,
  Attribute,
  tenantAttributeType,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  PUBLIC_SERVICES_MANAGERS,
  ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { config } from "../config/config.js";
import {
  RegistryData,
  InternalCertifiedAttribute,
  shouldKindBeIncluded,
} from "./openDataService.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const AGENCY_CLASSIFICATION = "Agency";

// Tipologia Gestori di Pubblici Servizi
export const PUBLIC_SERVICES_MANAGERS_TYPOLOGY = "Gestori di Pubblici Servizi";

// Tipologia Società in Conto Economico Consolidato
export const ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY =
  "Societa' in Conto Economico Consolidato";

export type TenantSeed = {
  origin: string;
  originId: string;
  description: string;
  attributes: Array<{ origin: string; code: string }>;
};

function toTenantKey(key: {
  origin: string | undefined;
  value: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, value: key.value });
}

function toAttributeKey(key: {
  origin: string | undefined;
  code: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, code: key.code });
}

async function checkAttributesPresence(
  readModelService: ReadModelServiceSQL,
  newAttributes: attributeRegistryApi.InternalCertifiedAttributeSeed[]
): Promise<boolean> {
  const attributes = await readModelService.getAttributes();

  const certifiedAttributeIndex = new Map(
    attributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [toAttributeKey({ origin: a.origin, code: a.code }), a])
  );

  const missingAttributes = newAttributes.filter(
    (i) =>
      !certifiedAttributeIndex.get(
        toAttributeKey({ origin: i.origin, code: i.code })
      )
  );

  return missingAttributes.length === 0;
}

export function getTenantUpsertData(
  registryData: RegistryData,
  platformTenants: Tenant[]
): TenantSeed[] {
  // Create a set of all existing tenant external IDs for quick lookup.
  // This is used to filter out institutions from the registry that don't
  // have a corresponding tenant in the platform.
  const platformTenantsIndex = new Set(
    platformTenants.map((t) => toTenantKey(t.externalId))
  );

  // Filter the full list of institutions from the registry to only include those
  // that are already present as tenants on the platform.
  const institutionsAlreadyPresent = registryData.institutions.filter(
    (i) =>
      i.id.length > 0 &&
      platformTenantsIndex.has(
        toTenantKey({ origin: i.origin, value: i.originId })
      )
  );

  // Map each institution to a "TenantSeed" object, which contains all the attributes
  // that should be assigned to the corresponding tenant in the platform.
  return institutionsAlreadyPresent.map((i) => {
    const attributesWithoutKind = match(i)
      // Agency - SCEC -> Assign institution name attribute only
      .with(
        {
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
          classification: AGENCY_CLASSIFICATION,
        },
        () => [
          {
            origin: i.origin,
            code: i.originId,
          },
        ]
      )
      // SCEC - AOO/UO -> Assign nothing
      .with(
        {
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
          classification: P.not(AGENCY_CLASSIFICATION),
        },
        () => []
      )
      // Agency - any -> Assign institution name attribute + category attribute
      .with({ classification: AGENCY_CLASSIFICATION }, () => [
        {
          origin: i.origin,
          code: i.category,
        },
        {
          origin: i.origin,
          code: i.originId,
        },
      ])
      // AOO/UO -> Assign category attribute only
      .otherwise(() => [
        {
          origin: i.origin,
          code: i.category,
        },
      ]);

    // This block handles the assignment of the "Gestore di Pubblico Servizio" (GPS) attribute (L37).
    const forcedGPSCategory = match(i)
      .with(
        // 1. If the institution is a traditional Public Services Manager.
        { kind: PUBLIC_SERVICES_MANAGERS_TYPOLOGY },
        // 2. If the institution is a Società in Conto Economico Consolidato (SCEC) from the legacy allowlist (to be removed).
        {
          kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
          originId: P.when((originId) =>
            config.economicAccountCompaniesAllowlist.includes(originId)
          ),
        },
        // 3. If the institution is a new SCEC with the S01G category from IPA.
        {
          kind: ECONOMIC_ACCOUNT_COMPANIES_TYPOLOGY,
          category: ECONOMIC_ACCOUNT_COMPANIES_PUBLIC_SERVICE_IDENTIFIER,
        },
        () => [
          {
            origin: i.origin,
            code: PUBLIC_SERVICES_MANAGERS,
          },
        ]
      )
      .otherwise(() => []);

    const attributes = [
      // Some kinds (Tipologia) are mapped to specific certified attributes
      ...(shouldKindBeIncluded(i)
        ? [
            {
              origin: i.origin,
              code: createHash("sha256").update(i.kind).digest("hex"),
            },
          ]
        : []),
      ...attributesWithoutKind,
      ...forcedGPSCategory,
    ];

    return {
      origin: i.origin,
      originId: i.originId,
      description: i.description,
      attributes,
    };
  });
}

export async function createNewAttributes(
  newAttributes: InternalCertifiedAttribute[],
  readModelService: ReadModelServiceSQL,
  headers: InteropHeaders,
  loggerInstance: Logger
): Promise<void> {
  const client = attributeRegistryApi.createAttributeApiClient(
    config.attributeRegistryUrl
  );

  for (const attribute of newAttributes) {
    loggerInstance.info(
      `Creating attribute ${attribute.origin}/${attribute.code}`
    );
    await client.createInternalCertifiedAttribute(attribute, {
      headers,
    });
  }

  // wait until every event reaches the read model store
  do {
    loggerInstance.info("Waiting for attributes to be created");
    await delay(config.attributeCreationWaitTime);
  } while (!(await checkAttributesPresence(readModelService, newAttributes)));
}

export function getNewAttributes(
  registryData: RegistryData,
  tenantUpsertData: TenantSeed[],
  attributes: Attribute[]
): InternalCertifiedAttribute[] {
  // get a set with all the certified attributes in the platform
  const platformAttributesIndex = new Set(
    attributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => toAttributeKey({ origin: a.origin, code: a.code }))
  );

  const newAttributesIndex = new Set(
    tenantUpsertData.flatMap((t) =>
      t.attributes.map((a) =>
        toAttributeKey({ origin: a.origin, code: a.code })
      )
    )
  );

  return registryData.attributes.filter(
    (a) =>
      newAttributesIndex.has(
        toAttributeKey({ origin: a.origin, code: a.code })
      ) &&
      !platformAttributesIndex.has(
        toAttributeKey({ origin: a.origin, code: a.code })
      )
  );
}

export async function getAttributesToAssign(
  platformTenants: Tenant[],
  platformAttributes: Attribute[],
  tenantSeeds: TenantSeed[],
  loggerInstance: Logger
): Promise<tenantApi.InternalTenantSeed[]> {
  const tenantsIndex = new Map(
    platformTenants.map((t) => [toTenantKey(t.externalId), t])
  );

  const certifiedAttributes = new Map(
    platformAttributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  return tenantSeeds
    .map((seed) => {
      const externalId = { origin: seed.origin, value: seed.originId };

      const tenant = tenantsIndex.get(toTenantKey(externalId));

      if (!tenant) {
        loggerInstance.error(`Tenant ${externalId} not found in the platform`);
        return undefined;
      }

      const tenantCurrentAttributes = new Map(
        tenant.attributes
          .filter(
            (attribute) =>
              attribute.type === tenantAttributeType.CERTIFIED &&
              !attribute.revocationTimestamp
          )
          .map((attribute) => certifiedAttributes.get(attribute.id))
          .filter((a): a is NonNullable<typeof a> => a !== undefined)
          .map((a) => [toAttributeKey({ origin: a.origin, code: a.code }), a])
      );

      return {
        externalId,
        name: tenant.name,
        certifiedAttributes: seed.attributes
          .filter(
            (a) =>
              !tenantCurrentAttributes.get(
                toAttributeKey({
                  origin: a.origin,
                  code: a.code,
                })
              )
          )
          .map((a) => ({
            origin: a.origin,
            code: a.code,
          })),
      };
    })
    .filter(
      (t): t is tenantApi.InternalTenantSeed =>
        t !== undefined && t.certifiedAttributes.length > 0
    );
}

export async function assignNewAttributes(
  attributesToAssign: tenantApi.InternalTenantSeed[],
  headers: InteropHeaders,
  loggerInstance: Logger
): Promise<void> {
  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const attributeToAssign of attributesToAssign) {
    loggerInstance.info(
      `Updating tenant ${
        attributeToAssign.externalId.value
      }. Adding attributes [${attributeToAssign.certifiedAttributes
        .map((a) => a.code)
        .join(", ")}]`
    );
    await tenantClient.internalUpsertTenant(attributeToAssign, { headers });
  }
}

export async function getAttributesToRevoke(
  tenantSeeds: TenantSeed[],
  platformTenants: Tenant[],
  platformAttributes: Attribute[]
): Promise<
  Array<{
    tOrigin: string;
    tExternalId: string;
    aOrigin: string;
    aCode: string;
  }>
> {
  const tenantSeedsIndex = new Map(
    tenantSeeds.map((t) => [
      toTenantKey({ origin: t.origin, value: t.originId }),
      new Set(
        t.attributes.map((a) =>
          toAttributeKey({ origin: a.origin, code: a.code })
        )
      ),
    ])
  );

  const certifiedAttributes = new Map(
    platformAttributes
      .filter((a) => a.kind === attributeKind.certified && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const canBeRevoked = (
    attribute: {
      origin: string;
      code: string;
    },
    tenantExternalId: { origin: string; value: string }
  ): boolean => {
    if (attribute.origin !== PUBLIC_ADMINISTRATIONS_IDENTIFIER) {
      return false;
    }

    const registryAttributes = tenantSeedsIndex.get(
      toTenantKey(tenantExternalId)
    );
    if (!registryAttributes) {
      return true;
    }

    return !registryAttributes.has(
      toAttributeKey({ origin: attribute.origin, code: attribute.code })
    );
  };

  return platformTenants.flatMap((t) =>
    t.attributes
      .filter(
        (attribute) =>
          attribute.type === tenantAttributeType.CERTIFIED &&
          !attribute.revocationTimestamp
      )
      .map((attribute) => certifiedAttributes.get(attribute.id))
      .filter(
        (a): a is NonNullable<typeof a & { origin: string; code: string }> =>
          a?.origin !== undefined && a?.code !== undefined
      )
      .filter((a) =>
        canBeRevoked(
          {
            origin: a.origin,
            code: a.code,
          },
          t.externalId
        )
      )
      .map((a) => ({
        tOrigin: t.externalId.origin,
        tExternalId: t.externalId.value,
        aOrigin: a.origin,
        aCode: a.code,
      }))
  );
}

export async function revokeAttributes(
  attributesToRevoke: Array<{
    tOrigin: string;
    tExternalId: string;
    aOrigin: string;
    aCode: string;
  }>,
  headers: InteropHeaders,
  loggerInstance: Logger
): Promise<void> {
  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const a of attributesToRevoke) {
    loggerInstance.info(
      `Updating tenant ${a.tExternalId}. Revoking attribute ${a.aCode}`
    );
    await tenantClient.internalRevokeCertifiedAttribute(undefined, {
      params: {
        tOrigin: a.tOrigin,
        tExternalId: a.tExternalId,
        aOrigin: a.aOrigin,
        aExternalId: a.aCode,
      },
      headers,
    });
  }
}
