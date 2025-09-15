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
  User,
  UserId,
  UserRole,
} from "pagopa-interop-models";
import { afterEach, inject, vi } from "vitest";
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
import {
  user as userTable,
  UserDB,
} from "pagopa-interop-selfcare-user-db-models";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { drizzle } from "drizzle-orm/node-postgres";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { userServiceBuilderSQL } from "../src/services/userServiceSQL.js";

export const { cleanup, readModelDB, userDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig"),
  undefined,
  undefined,
  inject("userSQLConfig")
);

const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const notificationConfigReadModelServiceSQL =
  notificationConfigReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  notificationConfigReadModelServiceSQL,
});

export const userService = userServiceBuilderSQL(userDB);

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

export const addOneUser = async (user: User): Promise<void> => {
  await insertUser(userDB, user);
};

const insertUser = async (
  userDB: ReturnType<typeof drizzle>,
  user: User
): Promise<void> => {
  const toInsert: UserDB = {
    userId: user.id,
    email: user.email,
    familyName: user.familyName,
    institutionId: generateId(),
    name: user.name,
    productRole: user.productRole,
    tenantId: user.tenantId,
  };
  await userDB.insert(userTable).values(toInsert);
};

afterEach(cleanup);

export const getMockUser = (tenantId?: TenantId, userId?: UserId): User => ({
  email: generateMock(z.string().email()),
  familyName: generateMock(z.string()),
  name: generateMock(z.string()),
  productRole: generateMock(UserRole),
  tenantId: tenantId ?? generateId<TenantId>(),
  id: userId ?? generateId<UserId>(),
});
