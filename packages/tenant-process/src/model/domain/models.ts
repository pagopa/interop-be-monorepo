import { TenantFeatureType } from "pagopa-interop-models";

export type ApiGetTenantsFilters = {
  name: string | undefined;
  features: TenantFeatureType[];
  externalIdOrigin: string | undefined;
  externalIdValue: string | undefined;
  offset: number;
  limit: number;
};
