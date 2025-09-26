/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterAll, afterEach, inject, vi } from "vitest";
import {
  Agreement,
  EService,
  Tenant,
  toReadModelEService,
  toReadModelTenant,
  toReadModelAgreement,
  Attribute,
  toReadModelAttribute,
  Delegation,
  toReadModelPurpose,
  Purpose,
} from "pagopa-interop-models";
import {
  genericLogger,
  initPDFGenerator,
  launchPuppeteerBrowser,
} from "pagopa-interop-commons";
import puppeteer, { Browser } from "puppeteer";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
  attributeReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertAttribute,
  upsertDelegation,
  upsertEService,
  upsertPurpose,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilder } from "../src/service/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/service/readModelSql.js";
import { config } from "../src/config/config.js";
import { agreementContractBuilder } from "../src/service/agreement/agreementContractBuilder.js";

export const {
  cleanup,
  readModelRepository,
  postgresDB,
  fileManager,
  readModelDB,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  inject("eventStoreConfig"),
  inject("fileManagerConfig"),
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

export const {
  agreements,
  attributes,
  eservices,
  tenants,
  delegations,
  purposes,
} = readModelRepository;

export const oldReadModelService = readModelServiceBuilder(readModelRepository);

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const pdfGenerator = await initPDFGenerator();

export const agreementContract = agreementContractBuilder(
  readModelService,
  pdfGenerator,
  fileManager,
  config,
  genericLogger
);

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await upsertAgreement(readModelDB, agreement, 0);
};
export const writeOnlyOneAgreement = async (
  agreement: Agreement
): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
  await upsertEService(readModelDB, eservice, 0);
};
export const updateOneEService = async (eservice: EService): Promise<void> => {
  await eservices.updateOne(
    {
      "data.id": eservice.id,
      "metadata.version": 0,
    },
    {
      $set: {
        data: toReadModelEService(eservice),
        metadata: {
          version: 1,
        },
      },
    }
  );
  await upsertEService(readModelDB, eservice, 1);
};

export const updateOneTenant = async (tenant: Tenant): Promise<void> => {
  await tenants.updateOne(
    {
      "data.id": tenant.id,
      "metadata.version": 0,
    },
    {
      $set: {
        data: toReadModelTenant(tenant),
        metadata: {
          version: 1,
        },
      },
    }
  );
  await upsertTenant(readModelDB, tenant, 1);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
  await upsertDelegation(readModelDB, delegation, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await writeInReadmodel(toReadModelPurpose(purpose), purposes);
  await upsertPurpose(readModelDB, purpose, 0);
};
