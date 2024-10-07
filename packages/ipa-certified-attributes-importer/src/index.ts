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
  // not needed? could be used to map into a certificate seed when needed
  // const attributes = await loadCertifiedAttributes(openData);

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const allInstitutions = [
    ...openData.institutions,
    ...openData.aoo,
    ...openData.uo,
  ];

  const getAttributes = await readModelService.getAttributes();
  const ipaTenants = await readModelService.getIPATenants();

  const getAttributeToAdd = allInstitutions.filter(
    (i) =>
      !getAttributes.find((a) => a.code === i.originId) &&
      ipaTenants.find((t) => t.externalId.value === i.originId)
  );

  const tesst = ipaTenants.reduce((acc, tenant) => {}, []);

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
