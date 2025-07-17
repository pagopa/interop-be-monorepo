import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { Agreement, EService, Purpose, Tenant } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

export const interopFeBaseUrl = "http://localhost/fe";

export const templateService = buildHTMLTemplateService();
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const commonHeaderPath = "/resources/templates/headers/common-header.hbs";
const commonHeaderBuffer = fs.readFileSync(
  `${dirname}/../src${commonHeaderPath}`
);
templateService.registerPartial("common-header", commonHeaderBuffer.toString());

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await agreementReadModelServiceSQL.upsertAgreement(agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await purposeReadModelServiceSQL.upsertPurpose(purpose, 0);
};

afterEach(cleanup);
