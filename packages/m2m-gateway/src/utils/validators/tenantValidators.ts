import { delegationApi } from "pagopa-interop-api-clients";
import { TenantId } from "pagopa-interop-models";
import { M2MAdminAuthData, M2MAuthData } from "pagopa-interop-commons";
import { cannotEditDeclaredAttributesForTenant } from "../../model/errors.js";
import { assertRequesterIsDelegateProducer } from "./delegationValidators.js";

export function assertTenantCanEditDeclaredAttributes(
  authData: M2MAdminAuthData | M2MAuthData, // TODO accept only M2MAdminAuthData
  delegation: delegationApi.Delegation | undefined,
  targetTenantId: TenantId
): void {
  if (!delegation) {
    if (authData.organizationId !== targetTenantId) {
      throw cannotEditDeclaredAttributesForTenant(targetTenantId, undefined);
    }
  } else {
    assertRequesterIsDelegateProducer(authData, delegation);
    if (delegation.delegatorId !== targetTenantId) {
      throw cannotEditDeclaredAttributesForTenant(targetTenantId, delegation);
    }
  }
}
