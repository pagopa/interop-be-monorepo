import {
  TenantVerifier,
  generateId,
  TenantRevoker,
} from "pagopa-interop-models";
import { DBContext } from "../src/db/db.js";
import { TenantDbTable } from "../src/model/db.js";

export async function resetTenantTables(dbContext: DBContext): Promise<void> {
  const tables = [
    TenantDbTable.tenant,
    TenantDbTable.tenant_certified_attribute,
    TenantDbTable.tenant_declared_attribute,
    TenantDbTable.tenant_feature,
    TenantDbTable.tenant_mail,
    TenantDbTable.tenant_verified_attribute,
    TenantDbTable.tenant_verified_attribute_revoker,
    TenantDbTable.tenant_verified_attribute_verifier,
  ];
  await dbContext.conn.none(`TRUNCATE TABLE ${tables.join(",")} CASCADE;`);
}

export const currentDate = new Date();

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: generateId(),
  verificationDate: currentDate,
});

export const getMockRevokedBy = (): TenantRevoker => ({
  id: generateId(),
  verificationDate: currentDate,
  revocationDate: currentDate,
});
