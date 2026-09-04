import { TenantFeatureType, TenantId } from "pagopa-interop-models";

export type ApiGetTenantsFilters = {
  tenantIds?: TenantId[];
  name: string | undefined;
  features: TenantFeatureType[];
  externalIdOrigin: string | undefined;
  externalIdValue: string | undefined;
  offset: number;
  limit: number;
};
