import { TenantId, Tenant } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { UIAuthData, M2MAdminAuthData } from "../auth/authData.js";
import { isUiAuthData, authRole } from "../auth/authorization.js";

type GetTenantById = (tenantId: TenantId) => Promise<Tenant | undefined>;

export const retrieveOriginFromAuthData = async (
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: { getTenantById: GetTenantById },
  retrieveTenant: (
    tenantId: TenantId,
    readModelService: { getTenantById: GetTenantById }
  ) => Promise<Tenant>
): Promise<string> =>
  await match(authData)
    .with(P.when(isUiAuthData), ({ externalId }) => externalId.origin)
    .with(
      { systemRole: authRole.M2M_ADMIN_ROLE },
      async ({ organizationId }) =>
        (
          await retrieveTenant(organizationId, readModelService)
        ).externalId.origin
    )
    .exhaustive();
