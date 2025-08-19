import { delegationApi } from "pagopa-interop-api-clients";
import { DelegationId, TenantId } from "pagopa-interop-models";
import { M2MAdminAuthData } from "pagopa-interop-commons";
import { cannotEditDeclaredAttributesForTenant } from "../../model/errors.js";
import { DelegationProcessClient } from "../../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../context.js";
import { assertRequesterIsDelegateConsumer } from "./delegationValidators.js";

export async function assertTenantCanEditDeclaredAttributes(
  authData: M2MAdminAuthData,
  targetTenantId: TenantId,
  delegationId: DelegationId | undefined,
  delegationProcessClient: DelegationProcessClient,
  headers: M2MGatewayAppContext["headers"]
): Promise<void> {
  if (!delegationId) {
    if (authData.organizationId !== targetTenantId) {
      throw cannotEditDeclaredAttributesForTenant(targetTenantId, undefined);
    }
  } else {
    const delegation: delegationApi.Delegation = (
      await delegationProcessClient.delegation.getDelegation({
        params: {
          delegationId,
        },
        headers,
      })
    ).data;

    assertRequesterIsDelegateConsumer(authData, delegation);
    if (delegation.delegatorId !== targetTenantId) {
      throw cannotEditDeclaredAttributesForTenant(targetTenantId, delegation);
    }
  }
}
