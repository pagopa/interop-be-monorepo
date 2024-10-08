import { createHash } from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
  removeDuplicateObjectsBy,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { ExternalId } from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./services/readModelService.js";
import {
  Category,
  Institution,
  getAllCategories,
  getAllInstitutions,
} from "./services/openDataExtractor.js";

const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId: uuidv4(),
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

type OpenData = {
  institutions: Institution[];
  aoo: Institution[];
  uo: Institution[];
  categories: Category[];
};

async function loadOpenData(): Promise<OpenData> {
  const institutions = await getAllInstitutions("Agency", new Map());

  const institutionsDetails = new Map(
    institutions.map((institution) => [
      institution.originId,
      {
        category: institution.category,
        kind: institution.kind,
      },
    ])
  );

  const aoo = await getAllInstitutions("AOO", institutionsDetails);

  const uo = await getAllInstitutions("UO", institutionsDetails);

  const categories = await getAllCategories();

  return {
    institutions,
    aoo,
    uo,
    categories,
  };
}

type InternalCertifiedAttribute = {
  code: string;
  description: string;
  origin: string;
  name: string;
};

const kindToBeExcluded: Set<string> = new Set([
  "Enti Nazionali di Previdenza ed Assistenza Sociale in Conto Economico Consolidato",
  "Gestori di Pubblici Servizi",
  "Societa' in Conto Economico Consolidato",
  "Stazioni Appaltanti",
]);

async function loadCertifiedAttributes(
  data: OpenData
): Promise<InternalCertifiedAttribute[]> {
  const attributesSeedsCategoriesNames = data.categories.map((c) => ({
    code: c.code,
    description: c.name,
    name: c.name,
    origin: c.origin,
  }));

  const attributeSeedsCategoriesKinds = removeDuplicateObjectsBy(
    data.categories,
    (c) => c.kind
  )
    .filter((c) => !kindToBeExcluded.has(c.kind))
    .map((c) => ({
      code: createHash("sha256").update(c.kind).digest("hex"),
      description: c.kind,
      name: c.name,
      origin: c.origin,
    }));

  const attributeSeedsCategories = [
    ...attributesSeedsCategoriesNames,
    ...attributeSeedsCategoriesKinds,
  ];

  const attributeSeedsInstitutions = [
    ...data.institutions,
    ...data.uo,
    ...data.aoo,
  ].map((i) => ({
    code: i.originId,
    description: i.description,
    origin: i.origin,
    name: i.description,
  }));

  return [...attributeSeedsCategories, ...attributeSeedsInstitutions];
}

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

try {
  const openData = await loadOpenData();

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const allInstitutions = [
    ...openData.institutions,
    ...openData.aoo,
    ...openData.uo,
  ];

  const attributes = await readModelService.getAttributes();
  const ipaTenants = await readModelService.getIPATenants();

  // get a map with all the certified attributes in the platform
  const certifiedAttributeIndex = new Map(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [{ origin: a.origin, code: a.code }, a])
  );

  // get a map with the external id of all tenants that have a selfcareId
  const tenantsMap = new Map(
    ipaTenants.filter((t) => t.selfcareId).map((t) => [t.externalId, t])
  );

  // filter the institutions open data retrieving only the tenants that are already present in the platform
  const institutionAlreadyPresent = allInstitutions.filter(
    (i) =>
      i.id.length > 0 && tenantsMap.has({ origin: i.origin, value: i.originId })
  );

  // generate a list of all possible attributes that could be created in the platform
  const attributesFromOpenData = await loadCertifiedAttributes(openData);

  // get the a list of tenant and attributes from the open data
  const fromRegistry = institutionAlreadyPresent.map((i) => {
    const attributesWithoutKind = match(i.classification)
      .with("Agency", () => [
        { origin: i.origin, code: i.category, revocationTimestamp: undefined },
        { origin: i.origin, code: i.originId, revocationTimestamp: undefined },
      ])
      .otherwise(() => [
        { origin: i.origin, code: i.category, revocationTimestamp: undefined },
      ]);

    const shouldKindBeExcluded = kindToBeExcluded.has(i.kind);

    const attributes = shouldKindBeExcluded
      ? attributesWithoutKind
      : [
          {
            origin: i.origin,
            code: createHash("sha256").update(i.kind).digest("hex"),
            revocationTimestamp: undefined,
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

  // get a set of all the attributes assigned to a tenant from the open data
  const newAttributesIndex = new Set(
    fromRegistry.flatMap((i) =>
      i.attributes.map((a) => ({ origin: a.origin, code: a.code }))
    )
  );

  // get a list of all the attributes that are not present in the platform
  // and are assigned to a tenant in the open data
  const newAttributes = attributesFromOpenData.filter(
    (a) =>
      newAttributesIndex.has({ origin: a.origin, code: a.code }) &&
      !certifiedAttributeIndex.has({ origin: a.origin, code: a.code })
  );

  // start the creation of the new attributes

  const client = attributeRegistryApi.createAttributeApiClient(
    config.attributeRegistryUrl
  );

  // generate a attribute creation event for each new attribute
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  const token = (await refreshableToken.get()).serialized;

  const headers = {
    "X-Correlation-Id": uuidv4(),
    Authorization: `Bearer ${token}`,
  };

  for (const attribute of newAttributes) {
    await client.createInternalCertifiedAttribute(attribute, {
      headers,
    });
  }

  // wait untill every event reach the read model store
  do {
    // wait 10 seconds
    await new Promise((r) => setTimeout(r, config.attributeCreationWaitTime));
  } while (!(await checkAttributesPresence(readModelService, newAttributes)));

  // all the new attributes are now present in the platform

  // get for each tenat the list of attributes that should be assigned

  const attributesToAssign: tenantApi.InternalTenantSeed[] = fromRegistry
    .map((i) => {
      const externalId = { origin: i.origin, value: i.originId };

      const tenant = ipaTenants.find(
        (t) =>
          t.externalId.origin === externalId.origin &&
          t.externalId.value === externalId.value
      );

      return tenant
        ? {
            externalId,
            name: tenant.name,
            certifiedAttributes: i.attributes.map((a) => ({
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

  const certifiedAttributeIndex2 = new Map(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const canBeRevoked = (
    tenantExternalId: ExternalId,
    attribute: InternalCertifiedAttribute
  ) => {
    const externalId = { origin: attribute.origin, value: attribute.code };

    if (
      tenantExternalId.origin === externalId.origin &&
      tenantExternalId.value === externalId.value
    ) {
      return false;
    }
  };

  const test = ipaTenants.map((t) => {
    const attributes = t.attributes
      .map((a) => certifiedAttributeIndex2.get(a.id))
      .filter((a) => a !== undefined) as InternalCertifiedAttribute[];
  });

  // get the list of non revocated certified attributes of every tenant from the platform present in the open data
  // const attributesFromTenant = new Map(
  //   ipaTenants
  //     .filter(
  //       (t) =>
  //         allInstitutions.find(
  //           (i) =>
  //             i.origin === t.externalId.origin &&
  //             i.originId === t.externalId.value
  //         ) !== undefined
  //     )
  //     .flatMap((t) =>
  //       t.attributes
  //         .filter(
  //           (a) =>
  //             a.type === "PersistentCertifiedAttribute" &&
  //             a.revocationTimestamp === null
  //         )
  //         .map((a) => [a.id, a])
  //     )
  // );
  // const attributesInOpenData = new Map(
  //   allInstitutions.map((i) => [{ origin: i.origin, code: i. }, i])
  // );
  //
  //
  // const attributesToRevoke: tenantApi.InternalTenantSeed[] = attributes.filter(

  // const attributesToRevoke2: {
  //   tOrigin: string;
  //   tExtenalId: string;
  //   aOrigin: string;
  //   aExtenalId: string;
  // } = ipaTenants.map((t) => attributeToRevoke.filter([k, a]) =>  ).map(a => ({
  //   tOrigin: externalId.origin,
  //   tExtenalId: externalId.value,
  //   aOrigin: .origin,
  // }));
  //
  // for (const attributeToAssign of attributesToAssign) {
  //   await tenantClient.internalRevokeCertifiedAttribute(undefined, {
  //     params: {
  //       tOrigin
  //     },
  //     headers,
  //   });
  // }

  // next steps
  // get all attributes
  // for each tenant find the attributes that should be assigned
  //    and that should be revoked
  // if a tenat is not present in the open data list
  //    log a warning and continue
  // revoke every attribute that should be revoked
  // for each attribute that should be assigned
  //    if already exist assign it
  //    if not create it and assign it
  //
  //
  // possible problems
  // after the creation of a resource we should wait for the event to be processed
  // so I'm not sure that is possible to assign the attribute to the tenant after it's creation
  //
  // is it possible that an attribute change? in this case we should revoke the old one
  // and assign the new one?

  // for (const tenant of ipaTenants) {
  // const tenantAttributes = attributes.filter(
  //   (a) => a.code === tenant.externalId.value
  // );
  // }
} catch (error) {
  loggerInstance.error(error);
}
