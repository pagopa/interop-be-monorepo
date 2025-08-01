import { TenantId, Tenant } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { UIAuthData, M2MAdminAuthData } from "../auth/authData.js";
import { isUiAuthData, authRole } from "../auth/authorization.js";

export const retrieveOriginFromAuthData = async (
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: {
    getTenantById: (tenantId: TenantId) => Promise<Tenant | undefined>;
  },
  tenantNotFound: (tenantId: TenantId) => Error
): Promise<string> => {
  const retrieveTenant = async (tenantId: TenantId): Promise<Tenant> => {
    const tenant = await readModelService.getTenantById(tenantId);
    if (tenant === undefined) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };

  return await match(authData)
    .with(P.when(isUiAuthData), ({ externalId }) => externalId.origin)
    .with(
      { systemRole: authRole.M2M_ADMIN_ROLE },
      async ({ organizationId }) =>
        (
          await retrieveTenant(organizationId)
        ).externalId.origin
    )
    .exhaustive();
};
