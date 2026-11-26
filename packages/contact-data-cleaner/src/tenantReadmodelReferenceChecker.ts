import { inArray } from "drizzle-orm";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

import { ContactReferenceChecker } from "./contactReferenceChecker.js";

const isTenantReadmodelEmpty = async (
  readmodelDB: DrizzleReturnType
): Promise<boolean> => {
  const tenants = await readmodelDB
    .select({ id: tenantInReadmodelTenant.id })
    .from(tenantInReadmodelTenant)
    .limit(1);
  return tenants.length === 0;
};

/**
 * Reads the contact references from the tenant readmodel, one query per page.
 * An empty tenant table (e.g. while the readmodel is being rebuilt) would make
 * every contact look orphan: in that case the lookup fails, so the page is
 * preserved and retried by the next run.
 */
export const tenantReadmodelReferenceCheckerBuilder = (
  readmodelDB: DrizzleReturnType
): ContactReferenceChecker => ({
  findReferencedContactIds: async (ids) => {
    if (ids.length === 0) {
      return new Set();
    }

    const rows = await readmodelDB
      .selectDistinct({ contactId: tenantInReadmodelTenant.contactId })
      .from(tenantInReadmodelTenant)
      .where(inArray(tenantInReadmodelTenant.contactId, ids));

    // Checked after the lookup, so that a table emptied before it is detected.
    // When some reference is found, the table is not empty.
    if (rows.length === 0 && (await isTenantReadmodelEmpty(readmodelDB))) {
      throw new Error(
        "Tenant readmodel is empty: contact references cannot be verified"
      );
    }

    return new Set(
      rows.flatMap(({ contactId }) => (contactId === null ? [] : [contactId]))
    );
  },
});
