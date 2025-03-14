/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import {
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { afterEach, inject } from "vitest";
export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(async () => {
  /*
  TODO the entries in tenant_verified_attribute_verifier and tenant_verified_attribute_revoker have a reference on the tenant table,
  but this reference doesn't have on delete cascade. During the cleanup of the test, those entries block the deletion of tenants (for example the verifier) from the tenant table because they are still referred.
  This problem could be fixed if we add ON DELETE CASCADE but I am not sure if that could bring to an unwanted behavior
*/
  await readModelDB.delete(tenantVerifiedAttributeVerifierInReadmodelTenant);
  await readModelDB.delete(tenantVerifiedAttributeRevokerInReadmodelTenant);

  await cleanup();
});
