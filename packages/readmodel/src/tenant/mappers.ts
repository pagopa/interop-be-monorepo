import { ParentTenant } from "pagopa-interop-models";

export function toParentTenants({
  parentTenantId,
  parentTenantName,
  parentTenantSubUnitType,
  rootTenantId,
  rootTenantName,
}: {
  parentTenantId: string | null;
  parentTenantName: string | null;
  parentTenantSubUnitType: string | null;
  rootTenantId: string | null;
  rootTenantName: string | null;
}): ParentTenant[] | undefined {
  if (parentTenantId === null || parentTenantName === null) {
    return undefined;
  }

  const parentTenant = ParentTenant.parse({
    id: parentTenantId,
    name: parentTenantName,
    subUnitType: parentTenantSubUnitType ?? undefined,
  });

  const rootTenant =
    rootTenantId !== null &&
    rootTenantId !== parentTenantId &&
    rootTenantName !== null
      ? ParentTenant.parse({ id: rootTenantId, name: rootTenantName })
      : undefined;

  return rootTenant ? [parentTenant, rootTenant] : [parentTenant];
}
