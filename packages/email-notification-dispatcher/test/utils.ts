import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  Agreement,
  EService,
  generateId,
  Purpose,
  Tenant,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  notificationConfigReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAgreement,
  upsertEService,
  upsertPurpose,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { UserDB } from "pagopa-interop-selfcare-user-db-models";
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
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const notificationConfigReadModelServiceSQL =
  notificationConfigReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
});

export const templateService = buildHTMLTemplateService();
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
function registerPartial(name: string, path: string): void {
  const buffer = fs.readFileSync(`${dirname}/../src${path}`);
  templateService.registerPartial(name, buffer.toString());
}

registerPartial(
  "common-header",
  "/resources/templates/headers/common-header.hbs"
);
registerPartial(
  "common-footer",
  "/resources/templates/footers/common-footer.hbs"
);

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOnePurpose = async (purpose: Purpose): Promise<void> => {
  await upsertPurpose(readModelDB, purpose, 0);
};

afterEach(cleanup);

export const getMockUser = (tenantId?: string, userId?: string): UserDB => ({
  email: "name@mailcom",
  familyName: "familyName",
  institutionId: generateId(),
  name: "name",
  productRole: "productRole",
  tenantId: tenantId ?? generateId<TenantId>(),
  userId: userId ?? generateId<UserId>(),
});
