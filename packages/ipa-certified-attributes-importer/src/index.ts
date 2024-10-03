import { createHash } from "crypto";
import {
  ReadModelRepository,
  logger,
  removeDuplicateObjectsBy,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
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
  ).map((c) => ({
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

try {
  const openData = await loadOpenData();
  const attributes = await loadCertifiedAttributes(openData);

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const ipaTenants = await readModelService.getIPATenants();

  for (const tenant of ipaTenants) {
    const tenantInstitutions = openData.institutions.filter(
      (i) => i.originId === tenant.externalId.value
    );
    const tenantAoo = openData.aoo.filter(
      (i) => i.originId === tenant.externalId.value
    );
    const tenantUo = openData.uo.filter(
      (i) => i.originId === tenant.externalId.value
    );
    const tenantCategories = openData.categories.filter(
      (c) => c.origin === tenant.externalId.value
    );
  }

  for (const ipaTenant of ipaTenants) {
    const ipaData = ipalist.find(
      (ipa) => ipa.codice === ipaTenant.externalId.value
    );

    if (!ipaData) {
      loggerInstance.warn(
        `IPA data not found for tenant ${ipaTenant.externalId.value}`
      );
      continue;
    }

    loggerInstance.info(
      `Found IPA data for tenant ${ipaTenant.externalId.value}`
    );
    // assign ipa data attribute to tenant

    // revoke tenat attribute if not present in ipa data
  }
} catch (error) {
  loggerInstance.error(error);
}
