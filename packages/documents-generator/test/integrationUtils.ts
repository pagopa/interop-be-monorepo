/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterAll, afterEach, inject, vi } from "vitest";
import {
  Agreement,
  EService,
  Tenant,
  Attribute,
  Delegation,
  Purpose,
} from "pagopa-interop-models";
import {
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
import { readModelServiceBuilderSQL } from "../src/service/readModelSql.js";

const { cleanup, fileManager, readModelDB } = await setupTestContainersVitest(
  undefined,
  inject("fileManagerConfig"),
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export { cleanup, fileManager };

const testBrowserInstance: Browser = await launchPuppeteerBrowser({
  pipe: true,
});
const closeTestBrowserInstance = async (): Promise<void> =>
  await testBrowserInstance.close();

afterAll(closeTestBrowserInstance);

vi.spyOn(puppeteer, "launch").mockImplementation(
  async () => testBrowserInstance
);

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  attributeReadModelServiceSQL,
  delegationReadModelServiceSQL,
});

export const pdfGenerator = await initPDFGenerator();

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};
