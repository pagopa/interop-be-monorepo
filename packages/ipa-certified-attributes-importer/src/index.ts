import { createHash } from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { Attribute, Tenant } from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./services/readModelService.js";
import {
  InternalCertifiedAttribute,
  RegistryData,
  getRegistryData,
  kindToBeExcluded,
} from "./services/openDataService.js";

type TenantSeed = {
  origin: string;
  originId: string;
  description: string;
  attributes: Array<{ origin: string; code: string }>;
};

type Header = {
  "X-Correlation-Id": string;
  Authorization: string;
};

const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId: uuidv4(),
});

async function checkAttributesPresence(
  readModelService: ReadModelService,
  newAttributes: attributeRegistryApi.InternalCertifiedAttributeSeed[]
): Promise<boolean> {
  const attributes = await readModelService.getAttributes();

  const certifiedAttributeIndex = new Map(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [{ origin: a.origin, code: a.code }, a])
  );

  const missingAttributes = newAttributes.filter(
    (i) => !certifiedAttributeIndex.get({ origin: i.origin, code: i.code })
  );

  return missingAttributes.length === 0;
}

function getTenantUpsertData(
  registryData: RegistryData,
  platformTenant: Tenant[]
): TenantSeed[] {
  // get a set with the external id of all tenants that have a selfcareId
  const platformTenantIndex = new Set(
    platformTenant.filter((t) => t.selfcareId).map((t) => t.externalId)
  );

  // filter the institutions open data retrieving only the tenants
  // that are already present in the platform
  const institutionAlreadyPresent = registryData.institutions.filter(
    (i) =>
      i.id.length > 0 &&
      platformTenantIndex.has({ origin: i.origin, value: i.originId })
  );

  // get a set with the attributes that should be created
  return institutionAlreadyPresent.map((i) => {
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

    const shouldKindBeExcluded = kindToBeExcluded.has(i.kind);

    const attributes = shouldKindBeExcluded
      ? attributesWithoutKind
      : [
          {
            origin: i.origin,
            code: createHash("sha256").update(i.kind).digest("hex"),
          },
          ...attributesWithoutKind,
        ];

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

  // wait untill every event reach the read model store
  do {
    await new Promise((r) => setTimeout(r, config.attributeCreationWaitTime));
  } while (!(await checkAttributesPresence(readModelService, newAttributes)));
}

function getNewAttributes(
  registryData: RegistryData,
  tenantUpsertData: TenantSeed[],
  attributes: Attribute[]
): InternalCertifiedAttribute[] {
  // get a set with all the certified attributes in the platform
  const platformAttributeIndex = new Set(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => ({ origin: a.origin, code: a.code }))
  );

  const newAttributesIndex = new Set(
    tenantUpsertData.flatMap((t) =>
      t.attributes.map((a) => ({ origin: a.origin, code: a.code }))
    )
  );

  return registryData.attributes.filter(
    (a) =>
      newAttributesIndex.has({ origin: a.origin, code: a.code }) &&
      !platformAttributeIndex.has({ origin: a.origin, code: a.code })
  );
}

async function assignNewAttribute(
  platformTenant: Tenant[],
  platformAttributes: Attribute[],
  tenantSeed: TenantSeed[],
  headers: Header
): Promise<void> {
  const tenantIndex = new Map(platformTenant.map((t) => [t.externalId, t]));

  const certifiedAttribute = new Map(
    platformAttributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const attributesToAssign: tenantApi.InternalTenantSeed[] = tenantSeed
    .map((i) => {
      const externalId = { origin: i.origin, value: i.originId };

      const tenant = tenantIndex.get(externalId);

      if (!tenant) {
        return undefined;
      }

      const tenantCurrentAttribute = new Map(
        tenant.attributes
          .map((a) => {
            const withRevocation = match(a)
              .with({ type: "PersistentCertifiedAttribute" }, (certified) => ({
                ...a,
                revocationTimestamp: certified.revocationTimestamp,
              }))
              .otherwise((_) => undefined);

            if (withRevocation) {
              const attribute = certifiedAttribute.get(withRevocation.id);

              if (attribute) {
                return {
                  ...attribute,
                  revocationTimestamp: withRevocation.revocationTimestamp,
                };
              }
            }

            return undefined;
          })
          .filter((a) => a !== undefined)
          .map((a) => [{ origin: a?.origin, code: a?.code }, a])
      );

      return tenant
        ? {
            externalId,
            name: tenant.name,
            certifiedAttributes: i.attributes
              .filter((a) => {
                const attribute = tenantCurrentAttribute.get({
                  origin: a.origin,
                  code: a.code,
                });

                if (!attribute) {
                  return true;
                }

                return attribute.revocationTimestamp !== undefined;
              })
              .map((a) => ({
                origin: a.origin,
                code: a.code,
              })),
          }
        : undefined;
    })
    .filter(
      (t) => t !== undefined && t.certifiedAttributes.length > 0
    ) as tenantApi.InternalTenantSeed[];

  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const attributeToAssign of attributesToAssign) {
    await tenantClient.internalUpsertTenant(attributeToAssign, { headers });
  }
}

async function revokeAttributes(
  registryData: RegistryData,
  tenantSeed: TenantSeed[],
  platformTenants: Tenant[],
  platformAttributes: Attribute[],
  headers: Header
): Promise<void> {
  const indexFromOpenData = new Set(
    registryData.attributes.map((a) => ({ origin: a.origin, value: a.code }))
  );

  const tenantSeedIndex = new Map(
    tenantSeed.map((t) => [
      { origin: t.origin, value: t.originId },
      new Set(t.attributes.map((a) => ({ origin: a.origin, value: a.code }))),
    ])
  );

  const certifiedAttribute = new Map(
    platformAttributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const canBeRevoked = (attribute: {
    origin: string;
    code: string;
  }): boolean => {
    const externalId = { origin: attribute.origin, value: attribute.code };

    if (attribute.origin !== "IPA") {
      return false;
    }

    const registryAttributes = tenantSeedIndex.get(externalId);
    if (!registryAttributes) {
      return false;
    }

    if (registryAttributes.has(externalId)) {
      return false;
    }

    return !indexFromOpenData.has(externalId);
  };

  const toRevoke = platformTenants.flatMap((t) =>
    t.attributes
      // eslint-disable-next-line sonarjs/no-identical-functions
      .map((a) => {
        const withRevocation = match(a)
          .with({ type: "PersistentCertifiedAttribute" }, (certified) => ({
            ...a,
            revocationTimestamp: certified.revocationTimestamp,
          }))
          .otherwise((_) => undefined);

        if (withRevocation) {
          const attribute = certifiedAttribute.get(withRevocation.id);

          if (attribute) {
            return {
              ...attribute,
              revocationTimestamp: withRevocation.revocationTimestamp,
            };
          }
        }

        return undefined;
      })
      .filter(
        (a) =>
          a !== undefined &&
          a.revocationTimestamp === undefined &&
          a.origin &&
          a.code &&
          canBeRevoked({ origin: a.origin, code: a.code })
      )
      .map((a) => ({
        tOrigin: t.externalId.origin,
        tExtenalId: t.externalId.value,
        aOrigin: a?.origin,
        aCode: a?.code,
      }))
  );

  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const a of toRevoke) {
    await tenantClient.internalRevokeCertifiedAttribute(undefined, {
      params: {
        tOrigin: a.tOrigin,
        tExternalId: a.tExtenalId,
        aOrigin: a.aOrigin as string,
        aExternalId: a.aCode as string,
      },
      headers,
    });
  }
}

async function getHeader(
  refreshableToken: RefreshableInteropToken,
  correlationId: string
): Promise<Header> {
  const token = (await refreshableToken.get()).serialized;

  return {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  };
}

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  const correlatsionId = uuidv4();

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  const registryData = await getRegistryData();

  const attributes = await readModelService.getAttributes();
  const ipaTenants = await readModelService.getIPATenants();

  const tenantUpsertData = getTenantUpsertData(registryData, ipaTenants);

  const newAttributes = getNewAttributes(
    registryData,
    tenantUpsertData,
    attributes
  );

  await createNewAttributes(
    newAttributes,
    readModelService,
    await getHeader(refreshableToken, correlatsionId)
  );

  await assignNewAttribute(
    ipaTenants,
    attributes,
    tenantUpsertData,
    await getHeader(refreshableToken, correlatsionId)
  );

  await revokeAttributes(
    registryData,
    tenantUpsertData,
    ipaTenants,
    attributes,
    await getHeader(refreshableToken, correlatsionId)
  );
} catch (error) {
  loggerInstance.error(error);
}
