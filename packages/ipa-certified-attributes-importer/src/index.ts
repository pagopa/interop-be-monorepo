import { createHash } from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  Attribute,
  CorrelationId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  attributeKind,
  generateId,
  tenantAttributeType,
} from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./services/readModelService.js";
import {
  InternalCertifiedAttribute,
  RegistryData,
  getRegistryData,
  kindsToInclude,
} from "./services/openDataService.js";

export type TenantSeed = {
  origin: string;
  originId: string;
  description: string;
  attributes: Array<{ origin: string; code: string }>;
};

type Header = {
  "X-Correlation-Id": CorrelationId;
  Authorization: string;
};

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId,
});

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
  readModelService: ReadModelService,
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
  // get a set with the external id of all tenants
  const platformTenantsIndex = new Set(
    platformTenants.map((t) => toTenantKey(t.externalId))
  );

  // filter the institutions open data retrieving only the tenants
  // that are already present in the platform
  const institutionsAlreadyPresent = registryData.institutions.filter(
    (i) =>
      i.id.length > 0 &&
      platformTenantsIndex.has(
        toTenantKey({ origin: i.origin, value: i.originId })
      )
  );

  // get a set with the attributes that should be created
  return institutionsAlreadyPresent.map((i) => {
    const attributesWithoutKind = match(i.classification)
      .with("Agency", () => [
        {
          origin: i.origin,
          code: i.category,
        },
        {
          origin: i.origin,
          code: i.originId,
        },
      ])
      .otherwise(() => [
        {
          origin: i.origin,
          code: i.category,
        },
      ]);

    const shouldKindBeIncluded = kindsToInclude.has(i.kind);

    const attributes = shouldKindBeIncluded
      ? [
          {
            origin: i.origin,
            code: createHash("sha256").update(i.kind).digest("hex"),
          },
          ...attributesWithoutKind,
        ]
      : attributesWithoutKind;

    return {
      origin: i.origin,
      originId: i.originId,
      description: i.description,
      attributes,
    };
  });
}

async function createNewAttributes(
  newAttributes: InternalCertifiedAttribute[],
  readModelService: ReadModelService,
  headers: Header
): Promise<void> {
  const client = attributeRegistryApi.createAttributeApiClient(
    config.attributeRegistryUrl
  );

  for (const attribute of newAttributes) {
    await client.createInternalCertifiedAttribute(attribute, {
      headers,
    });
  }

  // wait until every event reaches the read model store
  do {
    loggerInstance.info("Waiting for attributes to be created");
    await new Promise((r) => setTimeout(r, config.attributeCreationWaitTime));
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
  tenantSeeds: TenantSeed[]
): Promise<tenantApi.InternalTenantSeed[]> {
  const tenantsIndex = new Map(
    platformTenants.map((t) => [toTenantKey(t.externalId), t])
  );

  const certifiedsAttribute = new Map(
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
          .map((attribute) => certifiedsAttribute.get(attribute.id))
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

async function assignNewAttributes(
  attributesToAssign: tenantApi.InternalTenantSeed[],
  headers: Header
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
    tExtenalId: string;
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
    const externalId = { origin: attribute.origin, code: attribute.code };

    if (attribute.origin !== PUBLIC_ADMINISTRATIONS_IDENTIFIER) {
      return false;
    }

    const registryAttributes = tenantSeedsIndex.get(
      toTenantKey(tenantExternalId)
    );
    if (!registryAttributes) {
      return true;
    }

    return !registryAttributes.has(toAttributeKey(externalId));
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
        tExtenalId: t.externalId.value,
        aOrigin: a.origin,
        aCode: a.code,
      }))
  );
}

async function revokeAttributes(
  attributesToRevoke: Array<{
    tOrigin: string;
    tExtenalId: string;
    aOrigin: string;
    aCode: string;
  }>,
  headers: Header
): Promise<void> {
  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const a of attributesToRevoke) {
    loggerInstance.info(
      `Updating tenant ${a.tExtenalId}. Revoking attribute ${a.aCode}`
    );
    await tenantClient.internalRevokeCertifiedAttribute(undefined, {
      params: {
        tOrigin: a.tOrigin,
        tExternalId: a.tExtenalId,
        aOrigin: a.aOrigin,
        aExternalId: a.aCode,
      },
      headers,
    });
  }
}

async function getHeader(
  refreshableToken: RefreshableInteropToken,
  correlationId: CorrelationId
): Promise<Header> {
  const token = (await refreshableToken.get()).serialized;

  return {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  };
}

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  loggerInstance.info("Getting registry data");

  const registryData = await getRegistryData();

  const attributes = await readModelService.getAttributes();
  const tenants = await readModelService.getIPATenants();

  const tenantUpsertData = getTenantUpsertData(registryData, tenants);

  const newAttributes = getNewAttributes(
    registryData,
    tenantUpsertData,
    attributes
  );

  await createNewAttributes(
    newAttributes,
    readModelService,
    await getHeader(refreshableToken, correlationId)
  );

  const attributesToAssign = await getAttributesToAssign(
    tenants,
    attributes,
    tenantUpsertData
  );

  await assignNewAttributes(
    attributesToAssign,
    await getHeader(refreshableToken, correlationId)
  );

  const attributesToRevoke = await getAttributesToRevoke(
    tenantUpsertData,
    tenants,
    attributes
  );

  await revokeAttributes(
    attributesToRevoke,
    await getHeader(refreshableToken, correlationId)
  );

  loggerInstance.info("IPA certified attributes imporr completed");
} catch (error) {
  loggerInstance.error(error);
}
